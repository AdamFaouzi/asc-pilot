# Claude Code Project Prompt — Website-less Business Outreach SaaS

Paste everything below into Claude Code at the root of a new project directory.

---

## Setup: install these skills first

Before starting, clone and install the following skill repos so Claude Code can use them during the build:

```bash
mkdir -p .claude/skills && cd .claude/skills

for repo in \
  emilkowalski/skills \
  ConardLi/garden-skills \
  elayadesign/ai-design-skills \
  MengTo/Skills \
  jakubkrehel/skills \
  codeswithroh/tastemaker \
  Owl-Listener/designer-skills
do
  name=$(basename "$repo")
  git clone "https://github.com/$repo" "$name" 2>/dev/null || echo "Could not clone $repo — check the repo exists/is public"
done

cd ../..
```

Note: some of these repos may structure skills differently (single SKILL.md vs. nested folders per skill). After cloning, inspect each and move/symlink individual skill folders so each has a `SKILL.md` directly under `.claude/skills/<skill-name>/`. Claude Code will only pick up skills structured that way.

---

## Project prompt (paste after skills are installed)

I'm building a SaaS product called **[NAME YOUR PRODUCT]**. Here's the concept:

**Core loop:**
1. I specify a geographic area and a business category (or the tool scans broadly).
2. The system finds local businesses in that area that do **not** currently have a website (using search/maps data — e.g. Google Places API — checking for a missing website field, and cross-checking against a basic web search to catch false negatives like Instagram-only presences).
3. For each qualifying business, AI generates a real, presentable one-page (or few-page) website using whatever public info is available (name, category, location, photos if accessible, reviews, hours).
4. The generated site is hosted on a preview URL/subdomain specific to that business.
5. The system automatically contacts the business (email preferred, found via public listing or business page) with a short, personalized message showing the preview link and offering to make it live for **€30/month**.
6. If they like it, they can subscribe and pay online (Stripe), which flips the site from preview to production (custom domain support later) and starts the subscription.

**What I need you to build, in phases:**

### Phase 1 — Foundation
- Set up the project (recommend a stack: Next.js + TypeScript for the app/dashboard, Node backend or serverless functions, Postgres for data, Stripe for billing).
- Data model: businesses, leads, generated_sites, outreach_log, subscriptions.
- Environment/config scaffolding for API keys (Places API, email sending provider, Stripe, AI model API).

### Phase 2 — Discovery engine
- Integration with a places/business-search API to pull businesses by area + category.
- Filter for "no website" (missing website field) plus a secondary check (quick search/crawl) to reduce false positives.
- Store qualifying leads with contact info (business email if publicly listed; flag leads with no discoverable email for manual review rather than skipping silently).

### Phase 3 — AI website generator
- Given a lead's business data, generate a clean, professional one-page site (hero, about, services/menu, hours, contact, map embed, photos if available).
- Use one of the installed design/frontend skills for visual quality and layout variety so sites don't all look identical.
- Deploy each generated site to an isolated preview URL (e.g. subdomain per business or per-lead slug) that I can review and that's included in the outreach message.

### Phase 4 — Outreach automation
- Draft a short, personalized outreach email per lead referencing their business name and the preview link.
- Send via a transactional email provider (not personal Gmail, to protect deliverability/reputation).
- Log every send, and support unsubscribe/opt-out handling.
- **Do not build a mass-blast/spam-style sender** — rate-limit sends, keep messaging honest and specific per business, and include a clear opt-out. I'll want to review outreach compliance requirements for Cyprus/EU (GDPR + ePrivacy rules on unsolicited commercial email to businesses) before this phase goes live — flag anything that looks legally risky rather than assuming it's fine.

### Phase 5 — Payment + conversion
- Stripe Checkout/subscription flow: €30/month, triggered from a "Make it live" CTA on the preview site itself.
- On successful payment: promote the site from preview to a real subdomain (or connect their own domain later), activate the subscription, send a confirmation.
- Dashboard for me to see: leads found, sites generated, outreach sent, opens/replies if trackable, conversions, MRR.

### Phase 6 — Dashboard/ops
- Simple internal dashboard to monitor the pipeline end-to-end and manually intervene (edit a generated site before sending, retry failed sends, mark leads as bad/duplicate).

**Instructions for you (Claude Code):**
- Start with Phase 1 only — scaffold the project, set up the data model and config, and stop for my review before writing any outreach-sending code.
- Use the installed skills under `.claude/skills/` wherever they're relevant, especially for the website generation and dashboard UI quality.
- Ask me for API keys/credentials as needed rather than hardcoding placeholders that could get committed.
- Keep the codebase modular so I can swap the places-data source, email provider, or AI website generator independently.

---

## One thing worth flagging before you build this out
Automatically emailing businesses that haven't opted in touches GDPR and Cyprus's e-Privacy/spam rules — B2B unsolicited email has more leeway than B2C in most EU states, but there are still requirements (legitimate interest basis, clear sender identity, mandatory opt-out, no misleading subject lines). Worth a quick read of the actual regs or a lawyer's sanity check before Phase 4 goes live, since the technical build is the easy part here.
