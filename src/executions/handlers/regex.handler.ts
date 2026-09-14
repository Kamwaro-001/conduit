import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

@Injectable()
export class RegexHandler implements NodeHandler {
  private readonly logger = new Logger(RegexHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    const inputField: string = node.config?.inputField;
    const pattern: string = node.config?.pattern;
    const flags: string = node.config?.flags ?? 'i'; // default to case-insensitive

    if (!inputField || !pattern) {
      throw new Error(
        'REGEX node requires both "inputField" and "pattern" in config',
      );
    }

    const inputValue = this.resolvePayloadField(inputPayload, inputField);
    if (typeof inputValue !== 'string') {
      throw new Error(
        `REGEX node expected a string at "${inputField}", got ${typeof inputValue}`,
      );
    }

    const regex = new RegExp(pattern, flags);
    const match = regex.exec(inputValue);

    if (!match) {
      this.logger.log(`No match found for pattern /${pattern}/${flags}`);
      return {
        resultPayload: { found: false, match: null, extracted: null },
      };
    }

    // "extracted" prioritizes the first capture group (if any), otherwise the full match
    let extracted = match[1] !== undefined ? match[1] : match[0];

    if (node.config?.prepend) {
      extracted = node.config.prepend + extracted;
    }
    if (node.config?.append) {
      extracted = extracted + node.config.append;
    }

    this.logger.log(`REGEX match found: ${extracted.substring(0, 100)}...`);

    return {
      resultPayload: {
        found: true,
        match: match[0],
        extracted,
        groups: match.slice(1),
      },
    };
  }

  private resolvePayloadField(
    payload: Record<string, any>,
    fieldPath: string,
  ): unknown {
    return fieldPath
      .split('.')
      .reduce((obj: any, key: string) => obj?.[key], payload);
  }
}
