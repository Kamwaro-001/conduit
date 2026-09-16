import type { Node } from '../../workflows/entities/node.entity.js';

export interface NodeExecutionResult {
  resultPayload: Record<string, unknown>;
  sourceHandle?: string;
  delayMs?: number;
}

export interface NodeHandler {
  execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult>;
}
