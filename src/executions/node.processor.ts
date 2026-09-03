import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Node, NodeType } from '../workflows/entities/node.entity.js';
import { Repository } from 'typeorm';
import { GraphTraversalService } from './graph-traversal.service.js';
import { ExecutionsService } from './executions.service.js';
import { Edge } from '../workflows/entities/edge.entity.js';
import { ExecutionLog } from './entities/execution-log.entity.js';
import { ExecutionsGateway } from './executions.gateway.js';

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
  ) {
    super();
  }

  /*
   * BullMQ automatically calls this method whenever a job hits the queue.
   * Process: fetch node from db for type and config,
   * run the task, e.g send email, wait, check condition, etc.
   * Use GraphTraversalService to find the next nodes, and call dispatchNode() for the next steps.
   */

  async process(job: Job): Promise<any> {
    const { nodeId, workflowId, inputPayload } = job.data;

    const log = await this.logsRepo.save({
      workflow: { id: workflowId },
      node: { id: nodeId },
      status: 'RUNNING',
    });
    // save RUNNING to db
    this.gateway.broadcastNodeStatus(workflowId, nodeId, 'RUNNING');

    try {
      // fetch the specific node.
      const node = await this.nodesRepo.findOneBy({ id: nodeId });

      let sourceHandle: string | undefined = undefined;

      if (!node) {
        this.logger.error(`Node with id ${nodeId} not found`);
        return;
      }
      this.logger.log(`[EXECUTING] Node: ${node.type} | ID: ${nodeId}`);

      // execute logic based on Node type.
      switch (node.type) {
        case NodeType.TRIGGER:
          this.logger.log(`Trigger node started execution.`);
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
          // mock email send.
          this.logger.log(
            `📧 Sending Email to: ${node.config.recipient || 'default@test.com'}`,
          );
          break;
        case NodeType.WEBHOOK:
          this.logger.log(`Webhook node triggered.`);
          break;

        default:
          this.logger.warn(`Unknown node type: ${node.type}`);
      }

      // mark as success if nothing crashed
      await this.logsRepo.update(log.id, {
        status: 'SUCCESS',
        completed_at: new Date(),
        result_payload: { message: 'Node executed perfectly' },
      });

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

      // save SUCCESS to db
      this.gateway.broadcastNodeStatus(workflowId, nodeId, 'SUCCESS');
      return { success: true };
    } catch (error: any) {
      // why did the workflow stop?
      this.logger.error(`Node ${nodeId} failed: ${error.message}`);

      await this.logsRepo.update(log.id, {
        status: 'FAILED',
        completed_at: new Date(),
        error_message: error.message,
      });
      // save FAILED to db
      this.gateway.broadcastNodeStatus(workflowId, nodeId, 'FAILED');

      // rethrow to tell BullMQ that this job failed, so it can retry if configured.
      throw error;
    }
  }
}
