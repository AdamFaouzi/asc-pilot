import type { EmailSendResult, OutreachEmail } from "@/core/types";

import type { EmailProvider, EmailWebhookEvent } from "./types";

/** Maps Resend's event names onto the statuses the outreach log tracks. */
const EVENT_STATUS: Record<string, EmailWebhookEvent["status"]> = {
  "email.delivered": "DELIVERED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.delivery_delayed": undefined,
  "email.failed": "FAILED",
};

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

/**
 * Resend adapter.
 *
 * A transactional provider on a dedicated domain, never a personal mailbox —
 * both so deliverability doesn't rest on a consumer inbox's reputation, and so
 * the sender of a commercial email is unambiguous.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly key = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret?: string,
  ) {}

  async send(email: OutreachEmail): Promise<EmailSendResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
        // Carries the opt-out into the mail client's own UI, which is both
        // required by one-click unsubscribe and better for deliverability.
        headers: email.headers,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ResendResponse;

    if (!response.ok) {
      throw new Error(`Resend rejected the message (${response.status}): ${body.message ?? body.name ?? "unknown"}`);
    }

    return {
      provider: this.key,
      providerMessageId: body.id,
      acceptedAt: new Date(),
    };
  }

  /**
   * Resend signs webhooks with Svix headers. Without a configured secret this
   * refuses outright rather than trusting an unverified payload — anyone who
   * knows the URL could otherwise mark messages as bounced.
   */
  async parseWebhook(rawBody: string, headers: Record<string, string>): Promise<EmailWebhookEvent[]> {
    if (!this.webhookSecret) {
      throw new Error("RESEND_WEBHOOK_SECRET is not set — refusing to trust an unverified webhook");
    }

    const { Webhook } = await import("svix");
    const verified = new Webhook(this.webhookSecret).verify(rawBody, {
      "svix-id": headers["svix-id"] ?? "",
      "svix-timestamp": headers["svix-timestamp"] ?? "",
      "svix-signature": headers["svix-signature"] ?? "",
    }) as { type?: string; created_at?: string; data?: { email_id?: string; to?: string[] } };

    const type = verified.type ?? "unknown";

    return [
      {
        type,
        status: EVENT_STATUS[type],
        providerMessageId: verified.data?.email_id,
        recipient: verified.data?.to?.[0],
        occurredAt: verified.created_at ? new Date(verified.created_at) : new Date(),
        payload: verified,
      },
    ];
  }
}
