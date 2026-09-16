import type { EmailSendResult, OutreachEmail } from "@/core/types";

/** A normalised delivery event parsed out of a provider webhook. */
export interface EmailWebhookEvent {
  providerMessageId?: string;
  recipient?: string;
  /** Provider's own event name, kept for the raw event log. */
  type: string;
  /** Mapped to the OutreachStatus the message should move to, when it maps. */
  status?: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "COMPLAINED" | "FAILED";
  occurredAt: Date;
  payload: unknown;
}

/**
 * Transactional email sender.
 *
 * Deliberately narrow: one message to one recipient. There is no bulk method,
 * because a bulk method is the thing that turns considered outreach into a
 * blast. Rate limiting and suppression checks live above this interface.
 */
export interface EmailProvider {
  readonly key: string;

  send(email: OutreachEmail): Promise<EmailSendResult>;

  /** Verifies the webhook signature and normalises the payload. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<EmailWebhookEvent[]>;
}
