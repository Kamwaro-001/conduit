import { Injectable, Logger } from '@nestjs/common';
import { Node, NodeType } from '../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './handlers/node-handler.interface.js';
import {
  TriggerHandler,
  ScheduleHandler,
  DelayHandler,
  ConditionHandler,
  EmailHandler,
  WebhookHandler,
  HttpFetchHandler,
  VisionHandler,
  RegexHandler,
} from './handlers/index.js';

@Injectable()
export class NodeExecutorService {
  private readonly logger = new Logger(NodeExecutorService.name);
  private readonly handlers: Map<NodeType, NodeHandler>;

  constructor(
    triggerHandler: TriggerHandler,
    scheduleHandler: ScheduleHandler,
    delayHandler: DelayHandler,
    conditionHandler: ConditionHandler,
    emailHandler: EmailHandler,
    webhookHandler: WebhookHandler,
    httpFetchHandler: HttpFetchHandler,
    visionHandler: VisionHandler,
    regexHandler: RegexHandler,
  ) {
    this.handlers = new Map<NodeType, NodeHandler>([
      [NodeType.TRIGGER, triggerHandler],
      [NodeType.SCHEDULE, scheduleHandler],
      [NodeType.DELAY, delayHandler],
      [NodeType.CONDITION, conditionHandler],
      [NodeType.EMAIL, emailHandler],
      [NodeType.WEBHOOK, webhookHandler],
      [NodeType.HTTP_FETCH, httpFetchHandler],
      [NodeType.VISION, visionHandler],
      [NodeType.REGEX, regexHandler],
    ]);
  }

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    const handler = this.handlers.get(node.type);

    if (!handler) {
      this.logger.warn(`Unknown node type: ${node.type}`);
      return { resultPayload: {} };
    }

    return handler.execute(node, inputPayload);
  }
}
