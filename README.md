# ASC-Pilot

Finds local businesses that don't have a website, builds each one a site, and offers to make it live for €30/month.

**Status: Phase 1 (foundation) complete.** The project, data model, config, and swappable provider interfaces are in place. Discovery, generation, outreach, and billing are scaffolded as interfaces with unimplemented adapters — they fail loudly rather than pretending to work.

## Getting started

```bash
cp .env.example .env
npm install
npm run db:up          # Postgres in Docker
npm run db:migrate     # create the schema
npm run overture:fetch # free places data for Cyprus (~75s, one-off per release)
npm run dev
```

Then find some leads:

```bash
npm run discover -- --area paphos --limit 400
npm run generate -- --limit 10   # build sites (needs ANTHROPIC_API_KEY)
```

Then review them at `/review` — swipe through, accept or send back for work.
Only accepted sites can ever be linked in outreach:

```bash
npm run outreach                 # dry run; never sends
```

Then open http://localhost:3000 — it shows the pipeline and which integrations are configured. `GET /api/health` gives the same thing as JSON.

`npm run check:env` prints what each phase still needs.

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Project, data model, config, provider interfaces | Done |
| 2 | Discovery: Overture places, no-website filter, contact extraction | Done — [docs/DISCOVERY.md](docs/DISCOVERY.md) |
| 3 | Bilingual site generation + preview deploys | Done — [docs/GENERATION.md](docs/GENERATION.md) |
| 4 | Outreach email | Built, **cannot send** — see [docs/COMPLIANCE.md](docs/COMPLIANCE.md) |
| 5 | Stripe subscription, preview → live promotion | Built — [docs/BILLING.md](docs/BILLING.md) |
| 6 | Ops dashboard, site browser, review tool, manual interventions | Done — [docs/OPS.md](docs/OPS.md) |

## Stack notes

- **Next.js 16 / React 19**, App Router.
- **Prisma 7** connects through the `@prisma/adapter-pg` driver adapter, not a
  connection string in the schema. The URL reaches the CLI via
  `prisma.config.ts` and the client via `src/lib/db.ts`. Prisma 7 also stopped
  auto-loading `.env`, so standalone scripts import `dotenv/config` themselves.
- **Tailwind v4**, configured in CSS (`src/app/globals.css`), no JS config file.
- **DuckDB** reads the Overture parquet extract directly — no separate data store.

## Layout

```
prisma/schema.prisma   Data model (businesses, leads, sites, outreach, subscriptions)
src/core/              Provider-neutral domain types and helpers
src/lib/               Env config, Prisma client, logging, stats
src/providers/         One folder per swappable integration:
  places/              PlacesProvider   — overture | google | mock
  geocode/             GeocodeProvider  — static | nominatim
  generator/           SiteGenerator    — claude | mock
  hosting/             HostingProvider  — vercel | local
  email/               EmailProvider    — resend | console
  billing/             Stripe config and the plan definition
src/site/              Templates, bilingual dictionary, HTML renderer
src/pipeline/          Discovery and generation runs
src/app/               Next.js app (dashboard, review queue, health endpoint)
```

Every integration is chosen by an environment variable and resolved through a
single `get*Provider()` function, so swapping one out means writing one adapter
and changing one env var. Nothing above `src/providers/` imports a vendor SDK.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pipeline fits together.

## Safety rails built into Phase 1

- `OUTREACH_ENABLED` defaults to `false`, and the default email provider logs instead of sending.
- Every send is written to `outreach_log` before it goes out — the log is the audit trail.
- A `suppressions` table is keyed by email, so an opt-out survives re-discovering the same business.
- Contacts carry a confidence score; below `CONTACT_CONFIDENCE_THRESHOLD` a lead goes to manual review instead of automated outreach.
- Generated sites carry `reviewedByHuman`, and the generator interface requires anything it couldn't source to be listed in `unverifiedClaims` — a business's real website should not contain invented facts.
