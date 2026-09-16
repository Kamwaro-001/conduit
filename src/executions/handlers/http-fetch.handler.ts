import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class HttpFetchHandler implements NodeHandler {
  private readonly logger = new Logger(HttpFetchHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    const fetchUrl: string = node.config?.url;
    if (!fetchUrl) {
      throw new Error('HTTP_FETCH node is missing config.url');
    }

    const fetchMethod: string = (node.config?.method ?? 'GET').toUpperCase();
    const fetchHeaders: Record<string, string> = node.config?.headers ?? {};

    this.logger.log(`🌐 HTTP_FETCH: ${fetchMethod} ${fetchUrl}`);

    const fetchStart = Date.now();
    const fetchResponse = await fetch(fetchUrl, {
      method: fetchMethod,
      headers: { Accept: 'application/json', ...fetchHeaders },
      ...(fetchMethod !== 'GET' && fetchMethod !== 'HEAD'
        ? { body: JSON.stringify(inputPayload) }
        : {}),
    });

    if (!fetchResponse.ok) {
      throw new Error(
        `HTTP_FETCH to ${fetchUrl} responded with HTTP ${fetchResponse.status}`,
      );
    }

    const contentType = fetchResponse.headers.get('content-type') ?? '';
    const responseData = contentType.includes('application/json')
      ? await fetchResponse.json()
      : await fetchResponse.text();

    const durationMs = Date.now() - fetchStart;
    this.logger.log(
      `✅ HTTP_FETCH succeeded: HTTP ${fetchResponse.status} in ${durationMs}ms`,
    );

    return {
      resultPayload: {
        url: fetchUrl,
        method: fetchMethod,
        httpStatus: fetchResponse.status,
        durationMs,
        data: responseData,
      },
    };
  }
}
