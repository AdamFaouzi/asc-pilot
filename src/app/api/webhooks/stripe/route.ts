import type Stripe from "stripe";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { stripeClient, stripeConfig } from "@/providers/billing";
import { activateSubscription, alreadyProcessed, markProcessed } from "@/pipeline/billing";

export const dynamic = "force-dynamic";

/**
 * Stripe webhooks.
 *
 * Stripe is the source of truth for subscription state, and it retries — so
 * every handler here is idempotent and events are recorded once in
 * `processed_webhook_events`. The signature is verified before anything is
 * read: without that, anyone who knows the URL could mark a site as paid.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      raw,
      signature,
      stripeConfig().webhookSecret,
    );
  } catch (error) {
    logger.warn("billing.webhook_rejected", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // The session carries only an id for the subscription; fetch it so the
        // handler always works from full, current state.
        if (typeof session.subscription === "string") {
          const subscription = await stripeClient().subscriptions.retrieve(session.subscription);
          await activateSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await activateSubscription(event.data.object);
        break;
      }

      case "invoice.payment_failed": {
        logger.warn("billing.payment_failed", { invoice: event.data.object.id });
        break;
      }

      default:
        logger.debug("billing.webhook_ignored", { type: event.type });
    }

    await markProcessed(event.id, event.type);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Return 500 so Stripe retries rather than dropping the event.
    logger.error("billing.webhook_handler_failed", {
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
