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

    const startTime = Date.now();
    let durationMs = 0;

    // save RUNNING to db
    this.gateway.broadcastNodeStatus(workflowId, nodeId, 'RUNNING', 0);

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
        // improved condition node logic.
        case NodeType.CONDITION:
          const rules = node.config.rules || [];
          const matchType = node.config.matchType || 'AND';

          let conditionMet = false;

          if (rules.length === 0) {
            // Default to true if no rules are defined, or false if you prefer strictness
            conditionMet = true;
          } else {
            const evaluations = rules.map((rule: any) => {
              // Clean the field name (remove "payload." if the user typed it)
              const fieldName = rule.field.replace(/^payload\./, '');
              const actualValue = inputPayload
                ? inputPayload[fieldName]
                : undefined;

              // Coerce the rule value to a number if possible for accurate >= comparisons
              const expectedValue = isNaN(Number(rule.value))
                ? rule.value
                : Number(rule.value);

              // 3. Evaluate the operator
              switch (rule.operator) {
                case '>=':
                  return Number(actualValue) >= Number(expectedValue);
                case '==':
                  // Using loose equality so 100 == "100" evaluates correctly from text inputs
                  return actualValue == expectedValue;
                case '!=':
                  return actualValue != expectedValue;
                case 'contains':
                  return String(actualValue)
                    .toLowerCase()
                    .includes(String(expectedValue).toLowerCase());
                default:
                  return false;
              }
            });

            // Apply the Match Type
            if (matchType === 'AND') {
              conditionMet = evaluations.every((res: boolean) => res === true);
            } else if (matchType === 'OR') {
              conditionMet = evaluations.some((res: boolean) => res === true);
            }
          }

          sourceHandle = conditionMet ? 'true' : 'false';
          this.logger.log(
            `Condition evaluated to: ${sourceHandle} (Match: ${matchType}, Rules: ${rules.length})`,
          );
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

      durationMs = Date.now() - startTime;

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
      this.gateway.broadcastNodeStatus(
        workflowId,
        nodeId,
        'SUCCESS',
        durationMs,
      );
      return { success: true };
    } catch (error: any) {
      // why did the workflow stop?
      this.logger.error(`Node ${nodeId} failed: ${error.message}`);

      await this.logsRepo.update(log.id, {
        status: 'FAILED',
        completed_at: new Date(),
        error_message: error.message,
      });
      durationMs = Date.now() - startTime;
      // save FAILED to db
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
