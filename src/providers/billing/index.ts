import Stripe from "stripe";

import { getEnv, requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Billing.
 *
 * The price is deliberately NOT a constant in this file. It lives in Stripe and
 * is read from there, because the number is not settled — it will move as the
 * real cost of running this becomes clear. Hardcoding it means a price change
 * requires a deploy and silently disagrees with what Stripe actually charges.
 *
 * Two consequences follow, and both matter:
 *   - Changing the price in the Stripe dashboard changes the site CTA, the
 *     outreach email, and the dashboard, with no code change.
 *   - Existing subscribers are untouched. Stripe keeps a subscription on the
 *     price it was created with, and `Subscription.amountCents` records what
 *     was actually charged — so MRR is the sum of real amounts, never
 *     `subscribers × today's price`.
 */

export interface PlanDefinition {
  amountCents: number;
  currency: string;
  interval: "month" | "year";
  /** e.g. "€50/month" — derived from the live price, not written by hand. */
  displayPrice: string;
  displayPriceEl: string;
  /** True when these numbers came from Stripe rather than the fallback. */
  fromStripe: boolean;
}

/**
 * Used before Stripe is configured, so previews and dry-run outreach can render
 * a price. Marked `fromStripe: false` so nothing mistakes it for authoritative.
 */
const FALLBACK: PlanDefinition = {
  amountCents: 5000,
  currency: "eur",
  interval: "month",
  displayPrice: "€50/month",
  displayPriceEl: "€50/μήνα",
  fromStripe: false,
};

const CURRENCY_SYMBOLS: Record<string, string> = { eur: "€", usd: "$", gbp: "£" };

const INTERVAL_LABELS: Record<string, { en: string; el: string }> = {
  month: { en: "month", el: "μήνα" },
  year: { en: "year", el: "χρόνο" },
  week: { en: "week", el: "εβδομάδα" },
  day: { en: "day", el: "ημέρα" },
};

export function formatPrice(amountCents: number, currency: string, interval: string) {
  const symbol = CURRENCY_SYMBOLS[currency.toLowerCase()] ?? `${currency.toUpperCase()} `;
  // Whole amounts read better without trailing zeros: "€50", not "€50.00".
  const amount = amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2);
  const labels = INTERVAL_LABELS[interval] ?? { en: interval, el: interval };

  return {
    displayPrice: `${symbol}${amount}/${labels.en}`,
    displayPriceEl: `${symbol}${amount}/${labels.el}`,
  };
}

let cached: { plan: PlanDefinition; at: number } | undefined;
const CACHE_MS = 5 * 60 * 1000;

export function stripeClient(): Stripe {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY", "Stripe billing"));
}

export function stripeConfig() {
  return {
    secretKey: requireEnv("STRIPE_SECRET_KEY", "Stripe billing"),
    priceId: requireEnv("STRIPE_PRICE_ID", "Stripe billing"),
    webhookSecret: requireEnv("STRIPE_WEBHOOK_SECRET", "Stripe webhook verification"),
    publishableKey: getEnv().STRIPE_PUBLISHABLE_KEY,
  };
}

/**
 * The current plan, read from Stripe and cached briefly. Falls back rather than
 * throwing, so a Stripe outage degrades a preview page's price label instead of
 * taking the page down.
 */
export async function getPlan(): Promise<PlanDefinition> {
  const env = getEnv();

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return FALLBACK;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.plan;

  try {
    const price = await stripeClient().prices.retrieve(env.STRIPE_PRICE_ID);

    const amountCents = price.unit_amount;
    const interval = price.recurring?.interval;
    if (amountCents == null || !interval) {
      throw new Error(`Price ${env.STRIPE_PRICE_ID} is not a recurring price with a fixed amount`);
    }

    const plan: PlanDefinition = {
      amountCents,
      currency: price.currency,
      interval: interval as PlanDefinition["interval"],
      ...formatPrice(amountCents, price.currency, interval),
      fromStripe: true,
    };

    cached = { plan, at: Date.now() };
    return plan;
  } catch (error) {
    logger.warn("billing.price_lookup_failed", {
      error: error instanceof Error ? error.message : String(error),
      priceId: env.STRIPE_PRICE_ID,
    });
    return FALLBACK;
  }
}

/** Synchronous access for code paths that can't await. Prefer `getPlan()`. */
export const PLAN = FALLBACK;
