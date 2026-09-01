import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

// the producer - adding to the queue: toss nodes to Redis
@Injectable()
export class ExecutionsService {
  constructor(@InjectQueue('node-execution') private nodeQueue: Queue) {}

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
}
