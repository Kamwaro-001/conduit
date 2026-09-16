import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';

interface ConditionRule {
  field: string;
  operator: string;
  value: any;
}

@Injectable()
export class ConditionHandler implements NodeHandler {
  private readonly logger = new Logger(ConditionHandler.name);

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    const rules: ConditionRule[] = node.config?.rules || [];
    const matchType: 'AND' | 'OR' = node.config?.matchType || 'AND';

    const conditionMet = this.evaluateRules(rules, matchType, inputPayload);
    const sourceHandle = conditionMet ? 'true' : 'false';

    this.logger.log(
      `Condition evaluated to: ${sourceHandle} (Match: ${matchType}, Rules: ${rules.length})`,
    );

    return {
      resultPayload: {
        conditionMet,
        matchType,
        rulesEvaluated: rules.length,
        branch: sourceHandle,
      },
      sourceHandle,
    };
  }

  private evaluateRules(
    rules: ConditionRule[],
    matchType: 'AND' | 'OR',
    inputPayload: Record<string, any>,
  ): boolean {
    if (rules.length === 0) {
      // Default to true if no rules are defined
      return true;
    }

    const evaluations = rules.map((rule) =>
      this.evaluateRule(rule, inputPayload),
    );

    if (matchType === 'OR') {
      return evaluations.some((res) => res === true);
    }

    return evaluations.every((res) => res === true);
  }

  private evaluateRule(
    rule: ConditionRule,
    inputPayload: Record<string, any>,
  ): boolean {
    // Clean the field name (remove "payload." if the user typed it)
    const fieldName = rule.field?.replace(/^payload\./, '') ?? '';
    const actualValue = this.resolvePayloadField(inputPayload, fieldName);

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
