# Handoff: ASC-Pilot marketing site (`www/`)

Context for a fresh session. Written 29 August 2026.

## What this is

A standalone static marketing site for ASC-Pilot itself — the shop window, not
the operator tooling. It exists for two reasons: **Stripe account activation**
(a payment processor's review looks for a public site with a price, a contact
address, and legal pages) and general exposure.

It is deliberately separate from the Next.js app in `src/`. Plain HTML, CSS and
one small JS file. **No build step, no framework, no dependencies.** 252 KB.

```
www/
  index.html      landing page
  terms.html      terms of service
  privacy.html    privacy policy (GDPR)
  refunds.html    refunds and cancellation
  404.html        noindex, served by Cloudflare on unknown paths
  _headers        security headers + cache policy (Cloudflare Pages)
  robots.txt, sitemap.xml, favicon.svg
  README.md       deploy instructions + what to edit
  assets/         style.css, main.js, og.png, fonts/ (self-hosted Geist)
scripts/serve-www.mjs   local preview server (mimics Pages routing)
```

## Business facts baked into the pages

| | |
|---|---|
| Trading / registered name | **ASC-Pilot** |
| Registered address | Agiou Sergiou, 8048 Paphos, Cyprus |
| Contact email | adam.kamel.faouzi@gmail.com |
| Price | **€50 / month**, VAT included, cancel any month |
| Domain | **asc-pilot.com** (apex, no `www`) |
| Merchant country | Cyprus |

Started at €30 and was changed to €50 mid-session — 19 replacements across all
five pages, the README, the schema.org offer, and the regenerated `og.png`.

## Decisions worth not re-litigating

- **No testimonials, client logos, or customer-count numbers.** Those would be
  fabricated, and a reviewer looking at a brand-new merchant account is exactly
  who notices. The page carries its weight on the free preview offer instead.
  Do not "add social proof" without real, attributable sources.
- **The FAQ and legal pages are commitments, not filler.** They state a
  two-working-day support target, what counts as an included content change, and
  when a refund applies. Written to be honest and defensible, but they are
  drafts, not legal advice. Treat them as promises that have to be kept.
- **No cookies, no analytics, no third-party requests.** Geist is self-hosted in
  `assets/fonts/` rather than loaded from Google, which is why `privacy.html`
  can honestly say the page reports the visit to nobody. **Adding any analytics
  script breaks that claim** — update the privacy policy if you ever do.
- **The contact form has no backend.** It validates in the browser, then hands
  the message to the visitor's own mail app via `mailto:`. Nothing to host,
  nothing to breach. Replacing it with real submissions means a Pages Function
  or a form service, swapping the submit handler in `assets/main.js`.
- **Apex domain, not `www`.** All canonical and `og:url` tags declare
  `https://asc-pilot.com/…`. If the live site ends up on `www.asc-pilot.com`,
  all 21 references must be flipped, or the canonicals point at a host that
  redirects.
- Hero type is capped at 48px because at 60px the closing line orphaned "page."
  onto its own line inside the 680px measure.

## What was verified

Against `node scripts/serve-www.mjs` on `localhost:4321`, in a real browser:

- All routes return 200; `/nope` serves the branded 404; fonts, `og.png`,
  `robots.txt`, `sitemap.xml` all serve with correct content types.
- Form validation: empty submit raises three field errors, a malformed address
  raises only the email error, a clean submit clears all errors and fires the
  mailto handoff.
- Mobile (375px): hamburger morphs to an X, overlay opens, all five links fade
  and stagger in.
- No console errors. All pages tag-balanced with no broken local links.
- Structured data parses; `offers.price` is `"50.00"`.

One quirk, **not a site defect**: browser screenshots of this page come back
black whenever the tab is scrolled. Verified via computed styles that content is
visible and opaque at those positions, and it reproduces with the blur and
`backdrop-filter` both disabled. It is a capture-pipeline limitation. To
screenshot a lower section, hide the sections above it and shoot at scroll 0.

## Outstanding

1. **Street number on the address.** "Agiou Sergiou" has no building number.
   Stripe verification usually wants one, and it should match the registration
   documents.
2. **Deploy.** Not yet uploaded. Cloudflare dashboard → Workers & Pages →
   Create → Pages → Upload assets → drag the `www` folder itself (so
   `index.html` lands at the root). Or `npx wrangler pages deploy www
   --project-name=asc-pilot`. Then Custom domains → add `asc-pilot.com`; the
   domain is already in the user's Cloudflare account, so DNS and the
   certificate are handled automatically.
3. **Stripe activation**, after the URL is live. Business type, Cyprus country,
   MCC around 5734/7372, product description "Website design, hosting and
   maintenance for small businesses, sold as a €50/month subscription",
   statement descriptor "ASC PILOT", support email as above.
4. **Wiring Stripe into the app** — a separate job from activation. Create a
   *recurring* €50 EUR monthly Price, set `STRIPE_SECRET_KEY`,
   `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` in
   `.env`, then `npm run stripe:check`. That script already catches wrong key
   mode, a one-off price where a recurring one is needed, wrong currency, and a
   displayed price that disagrees with what Stripe would charge. Its own header
   notes the billing code has never run against live Stripe, only a simulated
   subscription object — run a full test-mode purchase before `sk_live_`.

## Gotchas

- **The €50 on this site is hardcoded HTML and does not read Stripe.** Unlike
  the generated customer sites, changing the price in the Stripe dashboard does
  not update this page. Edit `www/` too.
- **`docs/BILLING.md` and the app in `src/` still say €30.** Only `www/` was
  changed. Per that doc, customer sites already rendered keep the old price in
  their offer banner until `npm run rerender`.
- `docs/BILLING.md` also records why the merchant country matters: Stripe
  follows where the business is *established*, and does not support Lebanon as a
  merchant country. Cyprus is what makes the account eligible.
- **Do not add a `_redirects` file mapping `/terms` to `/terms.html`.** Pages
  already serves the clean URL and 307s the `.html` form to it, so such a rule
  builds an infinite redirect loop that is invisible locally and only appears
  once deployed. This happened once and took the legal pages offline. Internal
  links, canonicals and the sitemap all use the clean form.
- `.claude/launch.json` gained a `marketing-site` entry pointing at
  `scripts/serve-www.mjs`. Python's `http.server` could not be used — it hits a
  sandbox `PermissionError` on startup in this environment.
