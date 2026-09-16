import type { EmailSendResult, OutreachEmail } from "@/core/types";
import { logger } from "@/lib/logger";

import type { EmailProvider, EmailWebhookEvent } from "./types";

/**
 * Default provider: logs the message and sends nothing. Being the default means
 * a mistake in local dev or a half-configured deploy prints an email instead of
 * mailing a real business.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly key = "console";

  async send(email: OutreachEmail): Promise<EmailSendResult> {
    logger.info("outreach.email.console", {
      to: email.to,
      from: email.from,
      subject: email.subject,
      unsubscribeUrl: email.unsubscribeUrl,
      body: email.text,
    });

    return {
      provider: this.key,
      providerMessageId: `console-${Date.now()}`,
      acceptedAt: new Date(),
    };
  }

  async parseWebhook(): Promise<EmailWebhookEvent[]> {
    return [];
  }
}
