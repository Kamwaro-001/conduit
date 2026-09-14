import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class ScheduleHandler implements NodeHandler {
  private readonly logger = new Logger(ScheduleHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    // Entry point for cron-triggered workflows. Behaves like TRIGGER.
    this.logger.log('⏰ Schedule node fired.');

    return {
      resultPayload: {
        triggered_at: new Date().toISOString(),
        source: 'schedule',
      },
    };
  }
}
