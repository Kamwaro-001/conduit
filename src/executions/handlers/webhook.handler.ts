import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class WebhookHandler implements NodeHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    const url: string = node.config?.url;
    if (!url) {
      throw new Error('WEBHOOK node is missing config.url');
    }

    const method: string = (node.config?.method ?? 'POST').toUpperCase();
    const customHeaders: Record<string, string> = node.config?.headers ?? {};

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

    return {
      resultPayload: {
        url,
        method,
        httpStatus: response.status,
        durationMs: webhookDurationMs,
      },
    };
  }
}
