import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  messageId: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.defaultFrom =
      process.env.MAIL_FROM ?? 'Conduit <noreply@conduit.kamwaro.dev>';
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, from = this.defaultFrom } = options;

    // check from:
    this.logger.log(
      `Sending email from ${from} | to: ${to} | subject: "${subject}"`,
    );
    this.logger.log(`Sending email to ${to} | subject: "${subject}"`);

    const { data, error } = await this.resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    this.logger.log(`Email delivered | messageId: ${data?.id}`);
    return { messageId: data?.id ?? null };
  }
}
