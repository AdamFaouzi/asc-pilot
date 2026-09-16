/**
 * Validates the Stripe configuration before anything real depends on it.
 *
 * Written because the billing code has never run against live Stripe: it was
 * built and unit-tested against a simulated subscription object. This checks
 * the things that actually go wrong — wrong key mode, a one-off price where a
 * recurring one is needed, a price in the wrong currency, and a displayed price
 * that disagrees with what Stripe would charge.
 *
 *   npm run stripe:check
 */
import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getEnv } from "../src/lib/env";
import { formatPrice, getPlan, stripeClient } from "../src/providers/billing";

/**
 * What the deployed sites actually say.
 *
 * Config agreeing with Stripe is not enough: the price is baked into rendered
 * HTML, so a site deployed before a price change keeps advertising the old
 * number while Stripe charges the new one. A customer seeing €30 and being
 * charged €50 is the kind of error that ends in a chargeback, so this reads the
 * files rather than trusting configuration.
 */
async function pricesOnDeployedSites(): Promise<Map<string, number>> {
  const root = path.join(process.cwd(), "generated-sites", "preview");
  const counts = new Map<string, number>();

  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return counts;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    try {
      const html = await readFile(path.join(root, entry, "index.html"), "utf8");
      // The English label in the offer banner, e.g. "€50/month".
      const found = html.match(/[€$£]\s?[\d.,]+\/(?:month|year|week|day)/);
      if (found) counts.set(found[0], (counts.get(found[0]) ?? 0) + 1);
    } catch {
      // A site directory without an index.html is not a price problem.
    }
  }

  return counts;
}

/**
 * The marketing site's price is hardcoded HTML — it does not read Stripe, so it
 * drifts silently. A public page advertising one price while checkout charges
 * another is the version of this mistake a customer actually sees.
 */
async function pricesOnMarketingSite(): Promise<Map<string, number>> {
  const root = path.join(process.cwd(), "www");
  const counts = new Map<string, number>();

  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return counts;
  }

  for (const entry of entries.filter((name) => name.endsWith(".html"))) {
    const html = await readFile(path.join(root, entry), "utf8");
    // "€50 / month", "€50/month", and the schema.org "price": "50.00".
    for (const match of html.matchAll(/[€$£]\s?(\d+)(?:\.\d{2})?\s?\/\s?month/gi)) {
      const label = `€${match[1]}/month`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const schema = html.match(/"price"\s*:\s*"(\d+)(?:\.\d+)?"/);
    if (schema) {
      const label = `€${schema[1]}/month`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return counts;
}

function ok(message: string) {
  console.log(`  ✓ ${message}`);
}
function bad(message: string) {
  console.log(`  ✗ ${message}`);
}

async function main() {
  const env = getEnv();
  let failures = 0;

  console.log("Stripe configuration\n");

  for (const [name, value] of [
    ["STRIPE_SECRET_KEY", env.STRIPE_SECRET_KEY],
    ["STRIPE_PRICE_ID", env.STRIPE_PRICE_ID],
    ["STRIPE_WEBHOOK_SECRET", env.STRIPE_WEBHOOK_SECRET],
  ] as const) {
    if (value) ok(`${name} set`);
    else {
      bad(`${name} missing`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.log("\nAdd the missing values to .env, then run this again.");
    process.exitCode = 1;
    return;
  }

  const live = env.STRIPE_SECRET_KEY!.startsWith("sk_live_");
  console.log(`\n  ${live ? "⚠" : "✓"} key is in ${live ? "LIVE" : "test"} mode`);
  if (live) console.log("    Real cards will be charged. Use sk_test_ until you have run a full purchase.");

  const stripe = stripeClient();

  console.log("\nAccount");
  try {
    // The account this key belongs to. Also proves the key itself works.
    const account = await stripe.accounts.retrieveCurrent();
    ok(`connected: ${account.settings?.dashboard?.display_name ?? account.id} (${account.country ?? "?"})`);
    if (account.charges_enabled) ok("charges enabled");
    else {
      bad("charges are NOT enabled — Stripe onboarding is incomplete");
      failures += 1;
    }
  } catch (error) {
    bad(`could not reach Stripe: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nPrice");
  try {
    const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID!);

    if (!price.active) {
      bad("price is not active");
      failures += 1;
    }
    if (!price.recurring) {
      bad("price is one-off — a subscription needs a recurring price");
      failures += 1;
    } else {
      ok(`recurring every ${price.recurring.interval}`);
    }
    if (price.unit_amount == null) {
      bad("price has no fixed amount (metered or tiered prices are not supported)");
      failures += 1;
    } else {
      const { displayPrice } = formatPrice(
        price.unit_amount,
        price.currency,
        price.recurring?.interval ?? "month",
      );
      ok(`amount: ${displayPrice}`);
      if (price.currency !== "eur") {
        console.log(`    note: currency is ${price.currency.toUpperCase()}, not EUR`);
      }
    }
  } catch (error) {
    bad(`price lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    failures += 1;
  }

  console.log("\nWhat the sites will show");
  const plan = await getPlan();
  if (plan.fromStripe) {
    ok(`${plan.displayPrice} / ${plan.displayPriceEl} — read from Stripe`);
  } else {
    bad(`${plan.displayPrice} — still the code fallback, not Stripe`);
    failures += 1;
  }

  console.log("\nWhat the deployed sites actually say");
  const deployed = await pricesOnDeployedSites();

  if (deployed.size === 0) {
    console.log("  · no deployed sites found");
  } else {
    for (const [label, count] of [...deployed].sort((a, b) => b[1] - a[1])) {
      const matches = label.replace(/\s/g, "") === plan.displayPrice.replace(/\s/g, "");
      if (matches) ok(`${count} site(s) show ${label}`);
      else {
        bad(`${count} site(s) still show ${label}, but Stripe would charge ${plan.displayPrice}`);
        failures += 1;
      }
    }

    if ([...deployed.keys()].some((label) => label.replace(/\s/g, "") !== plan.displayPrice.replace(/\s/g, ""))) {
      console.log("    Fix with: npm run rerender");
    }
  }

  console.log("\nWhat the marketing site says");
  const marketing = await pricesOnMarketingSite();

  if (marketing.size === 0) {
    console.log("  · no www/ pages found");
  } else {
    for (const [label, count] of [...marketing].sort((a, b) => b[1] - a[1])) {
      const matches = label.replace(/\s/g, "") === plan.displayPrice.replace(/\s/g, "");
      if (matches) ok(`${count} mention(s) of ${label}`);
      else {
        bad(`${count} mention(s) of ${label}, but Stripe would charge ${plan.displayPrice}`);
        failures += 1;
      }
    }
    console.log("    www/ is hardcoded HTML — edit it by hand; rerender does not touch it.");
  }

  console.log(
    failures === 0
      ? "\nReady. Next: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, then buy one site with card 4242 4242 4242 4242."
      : `\n${failures} problem(s) above.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
