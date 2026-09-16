# Going live

## Why deployment comes before Stripe

The outreach email's entire value is a link the business owner can open. Three
things need a public URL before any of it works:

- the preview site linked in the email;
- Stripe's webhook, which is server-to-server and cannot reach `localhost`;
- Checkout's success and cancel URLs.

So the order is: deploy, point the domain, then wire Stripe.

## Choosing a host

The app now serves generated sites **from the database** rather than from disk,
so it no longer needs a persistent filesystem for the sites themselves. One
thing still does: **photo uploads** (`public/uploads/`), from both the operator
and the owner link.

That makes it a straight choice:

| | Persistent disk | What photos need |
| --- | --- | --- |
| **Railway / Render / Fly** | Yes | Nothing — a mounted volume works |
| **Vercel** | No | Blob storage (Vercel Blob, S3, R2) |

For one operator running a few hundred sites, a container host with a volume is
the simpler answer: Postgres sits alongside, uploads just work, and there is no
second storage service to reason about. Vercel is the better Next.js host in
general, but only after uploads move to blob storage.

## Environment for production

```bash
DATABASE_URL="postgresql://…"          # managed Postgres, not the Docker one
APP_URL="https://asc-pilot.com"        # no trailing slash
PREVIEW_DOMAIN="asc-pilot.com"
NODE_ENV="production"

ANTHROPIC_API_KEY="sk-ant-…"
GENERATOR_PROVIDER="claude"
PLACES_PROVIDER="overture"
OVERTURE_DATA_DIR="./data/overture"    # re-fetch after deploy: npm run overture:fetch

UNSUBSCRIBE_SECRET="…"                 # openssl rand -hex 32 — must be stable
                                        # forever: it signs unsubscribe and
                                        # owner links already in people's inboxes

STRIPE_SECRET_KEY="sk_test_…"
STRIPE_PRICE_ID="price_…"
STRIPE_WEBHOOK_SECRET="whsec_…"

EMAIL_PROVIDER="console"               # until the compliance review is settled
OUTREACH_ENABLED="false"
```

`UNSUBSCRIBE_SECRET` deserves care: it signs both unsubscribe links and owner
edit links. Rotating it silently breaks every link already sent, so generate it
once and keep it.

## After the domain points at the app

1. Set `APP_URL` to `https://asc-pilot.com`.
2. Run `npm run rerender`. Preview URLs, the checkout call and the offer banner
   are baked into each site's HTML — a site rendered against `localhost` keeps
   pointing at localhost forever otherwise.
3. Check one site loads at `https://asc-pilot.com/s/preview/<slug>`.

## DNS

- **The app**: an A or CNAME record at the host, per its instructions.
- **Email** (Phase 4, later): Resend needs SPF, DKIM and DMARC records on a
  sending subdomain — `send.asc-pilot.com` rather than the apex, so a
  deliverability problem never affects the main domain.
- **Per-business subdomains** are a later option: `<slug>.asc-pilot.com` needs a
  wildcard `*.asc-pilot.com` record and `HOSTING_PROVIDER=vercel`. Path-based
  URLs (`/s/preview/<slug>`) work today and need no wildcard.
