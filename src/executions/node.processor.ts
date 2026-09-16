import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Node } from '../workflows/entities/node.entity.js';
import { Edge } from '../workflows/entities/edge.entity.js';
import { ExecutionLog } from './entities/execution-log.entity.js';
import { GraphTraversalService } from './graph-traversal.service.js';
import { ExecutionsService } from './executions.service.js';
import { ExecutionsGateway } from './executions.gateway.js';
import { NodeExecutorService } from './node-executor.service.js';

// the worker - listens to Redis, grabs the jobs, executes the actual work.
@Processor('node-execution')
export class NodeProcessor extends WorkerHost {
  private readonly logger = new Logger(NodeProcessor.name);

  constructor(
    @InjectRepository(Node) private readonly nodesRepo: Repository<Node>,
    @InjectRepository(Edge) private readonly edgesRepo: Repository<Edge>,
    @InjectRepository(ExecutionLog)
    private readonly logsRepo: Repository<ExecutionLog>,
    private readonly traversalService: GraphTraversalService,
    private readonly executionsService: ExecutionsService,
    private readonly gateway: ExecutionsGateway,
    private readonly nodeExecutor: NodeExecutorService,
  ) {
    super();
  }

  /*
   * BullMQ automatically calls this method whenever a job hits the queue.
   * Process: fetch node from db, delegate execution to NodeExecutorService,
   * record execution logs and gateway broadcasts,
   * and dispatch next nodes via GraphTraversalService.
   */
  async process(job: Job): Promise<any> {
    const { nodeId, workflowId, inputPayload } = job.data;

    const log = await this.logsRepo.save({
      workflow: { id: workflowId },
      node: { id: nodeId },
      status: 'RUNNING',
    });

    const startTime = Date.now();
    let durationMs = 0;

    this.gateway.broadcastNodeStatus(workflowId, nodeId, 'RUNNING', 0);

    try {
      const node = await this.nodesRepo.findOneBy({ id: nodeId });

      if (!node) {
        this.logger.error(`Node with id ${nodeId} not found`);
        return;
      }

      this.logger.log(`[EXECUTING] Node: ${node.type} | ID: ${nodeId}`);

      const { resultPayload, sourceHandle, delayMs } =
        await this.nodeExecutor.execute(node, inputPayload);

      durationMs = Date.now() - startTime;

      await this.logsRepo.update(log.id, {
        status: 'SUCCESS',
        completed_at: new Date(),
        result_payload: resultPayload as any,
      });

      const workflowEdges = await this.edgesRepo.find({
        where: { workflow: { id: workflowId } },
      });

      const nextNodeIds = this.traversalService.getNextNodeIds(
        node.id,
        workflowEdges,
        sourceHandle,
      );

      // Merge this node's output into the payload so downstream nodes can use it.
      // The original webhook data is always preserved; node outputs are added under
      // their node id key to avoid accidental collisions, e.g.:
      //   { amount: 150, "node-condition": { conditionMet: true, branch: "true" } }
      const nextPayload = {
        ...inputPayload,
        [node.id]: resultPayload,
      };

      // Dispatch the next nodes into the queue.
      // If the CURRENT node configured a delay (e.g. DELAY node), hold the next jobs.
      const downstreamDelay = delayMs ?? 0;
      for (const nextNodeId of nextNodeIds) {
        await this.executionsService.dispatchNode(
          nextNodeId,
          workflowId,
          nextPayload,
          downstreamDelay,
        );
      }

      this.gateway.broadcastNodeStatus(
        workflowId,
        nodeId,
        'SUCCESS',
        durationMs,
      );
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Node ${nodeId} failed: ${error.message}`);

      await this.logsRepo.update(log.id, {
        status: 'FAILED',
        completed_at: new Date(),
        error_message: error.message,
      });

      durationMs = Date.now() - startTime;
      this.gateway.broadcastNodeStatus(
        workflowId,
        nodeId,
        'FAILED',
        durationMs,
      );

      // rethrow to tell BullMQ that this job failed, so it can retry if configured.
      throw error;
    }
  }
}
