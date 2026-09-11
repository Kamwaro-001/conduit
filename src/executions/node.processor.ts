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
import { MailService } from '../mail/mail.service.js';

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
    private readonly mailService: MailService,
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

    this.gateway.broadcastNodeStatus(workflowId, nodeId, 'RUNNING', 0);

    try {
      const node = await this.nodesRepo.findOneBy({ id: nodeId });

      if (!node) {
        this.logger.error(`Node with id ${nodeId} not found`);
        return;
      }

      this.logger.log(`[EXECUTING] Node: ${node.type} | ID: ${nodeId}`);

      let sourceHandle: string | undefined = undefined;
      let resultPayload: Record<string, unknown> = {};

      // execute logic based on Node type.
      switch (node.type) {
        case NodeType.TRIGGER: {
          this.logger.log(`Trigger node started execution.`);
          resultPayload = {
            triggered_at: new Date().toISOString(),
            payload_keys: inputPayload ? Object.keys(inputPayload) : [],
          };
          break;
        }

        case NodeType.CONDITION: {
          const rules = node.config.rules || [];
          const matchType = node.config.matchType || 'AND';

          let conditionMet = false;

          if (rules.length === 0) {
            // Default to true if no rules are defined
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
          resultPayload = {
            conditionMet,
            matchType,
            rulesEvaluated: rules.length,
            branch: sourceHandle,
          };
          break;
        }

        case NodeType.DELAY: {
          const delayMs = Number(node.config.delay_ms ?? 0);
          this.logger.log(
            `⏳ Delay node reached. Next nodes will be queued with ${delayMs}ms delay.`,
          );
          resultPayload = { delayed_ms: delayMs };
          break;
        }

        case NodeType.EMAIL: {
          const recipient: string =
            node.config.recipient || 'default@example.com';
          const subject: string =
            node.config.subject || 'Notification from Conduit';
          const body: string =
            node.config.body ||
            `<p>This email was triggered by your Conduit workflow.</p>`;

          this.logger.log(`Sending email to: ${recipient}`);

          const { messageId } = await this.mailService.sendEmail({
            to: recipient,
            subject,
            html: body,
          });

          this.logger.log(`Email delivered | messageId: ${messageId}`);
          resultPayload = { recipient, subject, messageId };
          break;
        }

        case NodeType.WEBHOOK: {
          const url: string = node.config.url;
          if (!url) throw new Error('WEBHOOK node is missing config.url');

          const method: string = (node.config.method ?? 'POST').toUpperCase();
          const customHeaders: Record<string, string> =
            node.config.headers ?? {};

          this.logger.log(`Outbound webhook: ${method} ${url}`);

          const webhookStart = Date.now();
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...customHeaders,
            },
            // Only attach a body for methods that support it
            ...(method !== 'GET' && method !== 'HEAD'
              ? { body: JSON.stringify(inputPayload) }
              : {}),
          });

          const webhookDurationMs = Date.now() - webhookStart;

          if (!response.ok) {
            throw new Error(
              `Webhook to ${url} responded with HTTP ${response.status}`,
            );
          }

          this.logger.log(
            `✅ Webhook succeeded: HTTP ${response.status} in ${webhookDurationMs}ms`,
          );
          resultPayload = {
            url,
            method,
            httpStatus: response.status,
            durationMs: webhookDurationMs,
          };
          break;
        }

        default:
          this.logger.warn(`Unknown node type: ${node.type}`);
      }

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
      // If the CURRENT node is a DELAY, tell BullMQ to hold the next jobs.
      for (const nextNodeId of nextNodeIds) {
        let delayMs = 0;
        if (node.type === NodeType.DELAY && node.config.delay_ms) {
          delayMs = Number(node.config.delay_ms);
        }

        await this.executionsService.dispatchNode(
          nextNodeId,
          workflowId,
          nextPayload,
          delayMs,
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
