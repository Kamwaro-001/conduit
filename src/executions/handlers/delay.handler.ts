import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class DelayHandler implements NodeHandler {
  private readonly logger = new Logger(DelayHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    const delayMs = Number(node.config?.delay_ms ?? 0);
    this.logger.log(
      `⏳ Delay node reached. Next nodes will be queued with ${delayMs}ms delay.`,
    );

    return {
      resultPayload: { delayed_ms: delayMs },
      delayMs,
    };
  }
}
