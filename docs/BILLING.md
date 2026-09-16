# Billing (Phase 5)

## The price is not in the code

`STRIPE_PRICE_ID` points at a Stripe Price, and that is the only place the
number lives. Change it in the Stripe dashboard and the preview CTA, the
outreach email, and the dashboard all follow — no deploy.

This matters because the price is provisional and will move once the real cost of
running this is clear. Two properties keep that safe:

- **Existing subscribers are untouched.** Stripe keeps a subscription on the
  price it was created with. Raising the list price affects new customers only.
- **MRR is the sum of what each subscription actually charges.**
  `Subscription.amountCents` records the amount at signup, and the dashboard
  sums those rows. It is never `subscribers × today's price` — those two
  diverge the moment you change the price, and the second one is a lie.

A fallback is used when Stripe isn't configured, so previews still render a
price. It is flagged `fromStripe: false` and is never authoritative — but note
it is what currently appears on every site, because Stripe has no key yet.

**The price is baked into rendered HTML.** Changing it in config or in Stripe
does not update sites that already exist. Run `npm run rerender` afterwards.
That re-render preserves reviews: it changes our offer banner, not the
business's own page.

## Lebanon

Stripe does not support Lebanon as a merchant country; Cyprus is fully
supported. Since the Stripe account's country follows where the *business* is
established rather than where you are sitting, Phase 5 needs either a
Cyprus-established entity or a merchant-of-record alternative such as Paddle,
which supports sellers in countries Stripe does not and handles EU VAT.

## Preview → live

The outreach email promises "the page you are looking at goes live", so
promotion must deliver exactly that. On `checkout.session.completed` the site is
re-rendered from the **same stored content, template, and variation**, with two
things removed:

- the "Make it live" banner — it would be selling them a site they just bought,
- the `noindex` tag — a site they are paying for has to be findable.

Both are our preview chrome, not their page. Verified by diff: those are the
*only* lines that differ between the reviewed preview and the live build.

Cancellation reverses it. `customer.subscription.deleted`, or a status of
`canceled`/`unpaid`, takes the live site down and archives the build.

## Webhooks

Stripe is the source of truth; this app mirrors it. Every handler is idempotent
and every event id is recorded in `processed_webhook_events`, because Stripe
retries and a replayed `checkout.session.completed` must not promote twice.

Signature verification happens before anything is read. Without it, anyone who
knew the URL could mark a site as paid.

Handled: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`.

A handler that throws returns 500 on purpose, so Stripe retries rather than
dropping the event.

## Setup

```bash
# In the Stripe dashboard: create a recurring Price, then
STRIPE_SECRET_KEY="sk_test_…"
STRIPE_PRICE_ID="price_…"
STRIPE_WEBHOOK_SECRET="whsec_…"
```

For local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Status

Built and unit-tested against a simulated Stripe subscription — activation,
promotion, cancellation, takedown, and replay protection all verified. The
failure paths (no key, bad slug, missing signature, forged signature) all return
clear errors rather than crashing.

**Not yet tested against real Stripe.** No test key has been used, so the
Checkout session creation and live webhook signatures are unexercised. That
needs `sk_test_…` and a `stripe listen` session.
