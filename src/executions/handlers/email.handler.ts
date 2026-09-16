import { Injectable, Logger } from '@nestjs/common';
import type { Node } from '../../workflows/entities/node.entity.js';
import type {
  NodeExecutionResult,
  NodeHandler,
} from './node-handler.interface.js';
import { MailService } from '../../mail/mail.service.js';

@Injectable()
export class EmailHandler implements NodeHandler {
  private readonly logger = new Logger(EmailHandler.name);

  constructor(private readonly mailService: MailService) {}

  async execute(
    node: Node,
    inputPayload: Record<string, any>,
  ): Promise<NodeExecutionResult> {
    let recipient: string = node.config?.recipient || 'default@example.com';
    let subject: string = node.config?.subject || 'Notification from Conduit';
    let body: string =
      node.config?.body ||
      '<p>This email was triggered by your Conduit workflow.</p>';

    recipient = this.interpolate(recipient, inputPayload);
    subject = this.interpolate(subject, inputPayload);
    body = this.interpolate(body, inputPayload);

    this.logger.log(`Sending email to: ${recipient}`);

    const { messageId } = await this.mailService.sendEmail({
      to: recipient,
      subject,
      html: body,
    });

    this.logger.log(`Email delivered | messageId: ${messageId}`);

    return {
      resultPayload: { recipient, subject, messageId },
    };
  }

  private interpolate(template: string, payload: Record<string, any>): string {
    if (!template) return '';
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolvePayloadField(payload, path.trim());
      return value !== undefined && value !== null ? String(value) : match;
    });
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
