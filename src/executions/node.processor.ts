import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Node, NodeType } from '../workflows/entities/node.entity.js';
import { Repository } from 'typeorm';
import { GraphTraversalService } from './graph-traversal.service.js';
import { ExecutionsService } from './executions.service.js';
import { Edge } from '../workflows/entities/edge.entity.js';

// the worker - listens to Redis, grabs the jobs, executes the actual work.
@Processor('node-execution')
export class NodeProcessor extends WorkerHost {
  private readonly logger = new Logger(NodeProcessor.name);

  constructor(
    @InjectRepository(Node) private readonly nodesRepo: Repository<Node>,
    @InjectRepository(Node) private readonly edgesRepo: Repository<Edge>,
    private readonly traversalService: GraphTraversalService,
    private readonly executionsService: ExecutionsService,
  ) {
    super();
  }

  // BullMQ automatically calls this method whenever a job hits the queue
  async process(job: Job): Promise<any> {
    const { nodeId, workflowId, inputPayload } = job.data;

    console.log(`[EXECUTING] Node: ${nodeId} | Workflow: ${workflowId}`);

    // TODO:
    // 1. Fetch the Node from the database to get its type & config.
    // 2. Run the task (e.g., Send Email, Wait, Check Condition).
    // 3. Use GraphTraversalService to find the next nodes.
    // 4. Call dispatchNode() for the next steps.

    let sourceHandle: string | undefined = undefined;

    // fetch the specific node.
    const node = await this.nodesRepo.findOneBy({ id: nodeId });
    if (!node) {
      this.logger.error(`Node with id ${nodeId} not found`);
      return;
    }
    this.logger.log(`[EXECUTING] Node: ${node.type} | ID: ${nodeId}`);

    // execute logic based on Node type.
    switch (node.type) {
      case NodeType.TRIGGER:
        // mock email send.
        this.logger.log(
          `📧 Sending Email to: ${node.config.recipient || 'default@test.com'}`,
        );
        break;
      case NodeType.CONDITION:
        // e.g if payload.amount > 100 follow the 'true' path
        const field = node.config.field as string;
        const threshold = node.config.threshold as number;

        if (inputPayload && inputPayload[field] > threshold) {
          sourceHandle = 'true';
        } else {
          sourceHandle = 'false';
        }
        this.logger.log(`Condition evaluated to: ${sourceHandle}`);
        break;
      case NodeType.DELAY:
        // log delay
        this.logger.log(
          `⏳ Delay node reached. Pausing for ${node.config.delay_ms}ms.`,
        );
        break;
      case NodeType.EMAIL:
      case NodeType.WEBHOOK:
        this.logger.log(`🚀 Trigger node started execution.`);
        break;

      default:
        this.logger.warn(`Unknown node type: ${node.type}`);
    }

    const workflowEdges = await this.edgesRepo.find({
      where: { workflow: { id: workflowId } },
    });

    const nextNodeIds = this.traversalService.getNextNodeIds(
      node.id,
      workflowEdges,
      sourceHandle,
    );

    // 4. Dispatch the next nodes into the queue
    for (const nextNodeId of nextNodeIds) {
      // If the CURRENT node was a delay, we tell BullMQ to delay the NEXT jobs
      let delayMs = 0;
      if (node.type === NodeType.DELAY && node.config.delay_ms) {
        delayMs = Number(node.config.delay_ms);
      }

      await this.executionsService.dispatchNode(
        nextNodeId,
        workflowId,
        inputPayload,
        delayMs,
      );
    }

    return { success: true };
  }
}
