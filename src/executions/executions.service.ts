import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ExecutionLog } from './entities/execution-log.entity.js';

// the producer - adding to the queue: toss nodes to Redis
@Injectable()
export class ExecutionsService {
  constructor(
    @InjectQueue('node-execution') private nodeQueue: Queue,
    @InjectRepository(ExecutionLog)
    private readonly logsRepo: Repository<ExecutionLog>,
  ) {}

  async dispatchNode(
    nodeId: string,
    workflowId: string,
    inputPayload: any,
    delayMs: number = 0,
  ) {
    // push to Redis immediately
    await this.nodeQueue.add(
      'execute-node',
      { nodeId, workflowId, inputPayload }, // data passed from previous node or webhook
      { delay: delayMs },
    );
  }

  /**
   * Return execution logs for a workflow, most recent first.
   * Each log includes the node id, status, result_payload, error_message, and timings.
   */
  findLogs(workflowId: string): Promise<ExecutionLog[]> {
    return this.logsRepo.find({
      where: { workflow: { id: workflowId } },
      relations: { node: true },
      order: { started_at: 'DESC' },
    });
  }
}
