import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getEmailProvider } from "@/providers/email";

export const dynamic = "force-dynamic";

/**
 * Delivery events from the email provider.
 *
 * Bounces and complaints are suppressions, not statistics: a hard bounce means
 * the address is wrong and a complaint means they consider it spam. Both must
 * stop us contacting that address ever again, which is why they're written to
 * the suppression list here rather than only recorded on the message.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let events;
  try {
    events = await getEmailProvider().parseWebhook(raw, headers);
  } catch (error) {
    logger.warn("outreach.webhook.rejected", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  for (const event of events) {
    const message = event.providerMessageId
      ? await prisma.outreachMessage.findFirst({
          where: { providerMessageId: event.providerMessageId },
        })
      : null;

    if (message) {
      await prisma.outreachEvent.create({
        data: {
          messageId: message.id,
          type: event.type,
          payload: event.payload as never,
          occurredAt: event.occurredAt,
        },
      });

      if (event.status) {
        await prisma.outreachMessage.update({
          where: { id: message.id },
          data: {
            status: event.status,
            deliveredAt: event.status === "DELIVERED" ? event.occurredAt : undefined,
            firstOpenAt:
              event.status === "OPENED" && !message.firstOpenAt ? event.occurredAt : undefined,
            firstClickAt:
              event.status === "CLICKED" && !message.firstClickAt ? event.occurredAt : undefined,
          },
        });
      }
    }

    const address = (event.recipient ?? message?.toAddress)?.toLowerCase();
    if (address && (event.status === "BOUNCED" || event.status === "COMPLAINED")) {
      await prisma.suppression.upsert({
        where: { email: address },
        create: {
          email: address,
          reason: event.status === "BOUNCED" ? "HARD_BOUNCE" : "COMPLAINED",
          source: "webhook",
        },
        update: {},
      });
      logger.info("outreach.suppressed", { email: address, reason: event.status });
    }
  }

  // Acknowledge regardless — the provider retries otherwise, and duplicate
  // events are already de-duplicated by the append-only event log.
  return NextResponse.json({ received: events.length });
}

export async function GET() {
  return NextResponse.json({ provider: getEnv().EMAIL_PROVIDER });
}
