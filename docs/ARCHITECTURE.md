# Architecture

## The pipeline

```
DiscoveryRun ──▶ Business ──▶ Lead ──▶ GeneratedSite ──▶ OutreachMessage ──▶ Subscription
   (area +       (what the    (what we   (versioned,       (append-only        (Stripe
    category)     provider     intend to  human-reviewed)    audit log)          mirror)
                  said)        pitch)
```

Each arrow is a phase, and each phase can be run, retried, and inspected on its own.

### Why Business and Lead are separate

`Business` is a faithful record of what a places provider returned, keyed by
`(source, sourceId)`. Re-running discovery updates it; it never carries pipeline
state. `Lead` is the decision to pitch that business, and carries the status
machine, the public slug, and the review notes. The split means re-scanning an
area can't reset a lead you already contacted, and switching places providers
doesn't orphan the outreach history.

### Why contacts are rows, not a column

Discovery finds several plausible ways to reach a business — an email on the
Google listing, one on a Facebook page, one scraped from a directory — of
varying quality. Each becomes a `Contact` with a `source` and a `confidence`.
Anything below `CONTACT_CONFIDENCE_THRESHOLD` routes the lead to
`NEEDS_REVIEW` rather than being dropped silently or emailed blindly.

### Why sites are versioned

`GeneratedSite` has a `version` per lead. The operator can regenerate or hand-edit
a site without losing the version that was already linked in an outreach email,
and Phase 5 promotes the exact deployment the business saw rather than rebuilding
it — the site they paid for is the site they get.

## Swapping providers

Every integration sits behind an interface in `src/providers/<area>/types.ts`,
with adapters beside it and a `get*Provider()` resolver in `index.ts` that reads
one environment variable. To swap a vendor: write an adapter, add it to the
switch, change the env var. Nothing outside `src/providers/` imports a vendor SDK.

| Area | Interface | Adapters | Env var |
| --- | --- | --- | --- |
| Places | `PlacesProvider` | `google_places`, `mock` | `PLACES_PROVIDER` |
| Generation | `SiteGenerator` | `claude`, `mock` | `GENERATOR_PROVIDER` |
| Hosting | `HostingProvider` | `vercel`, `local` | `HOSTING_PROVIDER` |
| Email | `EmailProvider` | `resend`, `console` | `EMAIL_PROVIDER` |

The `mock`/`console`/`local` adapters are the defaults, and they work offline —
so the whole pipeline can be exercised end to end before a single account exists,
and a half-configured deploy prints an email instead of mailing a real business.

Adapters for services we haven't wired up throw with the phase named
(`"...is not implemented yet (Phase 3)"`) rather than returning empty results.
A discovery run that finds nothing because of a config mistake should be an
error, not a quiet zero.

## Configuration

`src/lib/env.ts` validates the environment once with Zod. Only `DATABASE_URL` is
required to boot. Everything else is optional at startup and read through
`requireEnv(key, feature)` at the point of use, so a missing key produces
"`ANTHROPIC_API_KEY` is not set, but the Claude site generator needs it" instead
of a confusing failure three layers down.

## Outreach safety

The design assumption is that outreach is the part that can cause real-world
harm, so the constraints live in the schema and config rather than in whatever
code Phase 4 ends up writing:

- `OUTREACH_ENABLED` gates all sending and defaults to `false`.
- `EmailProvider` has no bulk send method — one message, one recipient.
- `OutreachMessage` rows are written in `QUEUED` state before anything is sent;
  a message that never went out stays as `BLOCKED` with a `blockedReason`.
- `Suppression` is keyed by email address, not by lead.
- Rate limits (`OUTREACH_DAILY_LIMIT`, `OUTREACH_MIN_INTERVAL_SECONDS`) are
  config, not constants.

See [COMPLIANCE.md](COMPLIANCE.md) for what still has to be settled before Phase 4 runs.
