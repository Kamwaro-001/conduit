import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class TriggerHandler implements NodeHandler {
  private readonly logger = new Logger(TriggerHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    this.logger.log('Trigger node started execution.');

    return {
      resultPayload: {
        triggered_at: new Date().toISOString(),
        payload_keys: inputPayload ? Object.keys(inputPayload) : [],
      },
    };
  }
}
