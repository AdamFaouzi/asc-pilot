# ASC Pilot marketing site

The public business page: what we sell, what it costs, and the legal pages a
payment processor expects to find before it activates an account.

It is plain HTML, CSS and one small JavaScript file. **No build step**, no
framework, no dependencies. It is deliberately separate from the Next.js app in
`src/` — that app is the operator's tool, this is the shop window.

```
index.html      the landing page
terms.html      terms of service
privacy.html    privacy policy (GDPR)
refunds.html    refunds and cancellation
404.html        served by Cloudflare on an unknown path
_headers        security headers and cache policy (Cloudflare Pages)
assets/         stylesheet, script, self-hosted Geist, share image
```

## Before it goes live

Three things are placeholders. Search for the square brackets:

- `[REGISTERED BUSINESS NAME]` and `[STREET, TOWN, POSTCODE]` in the footer of
  every page and in the opening section of the three legal pages. Stripe checks
  that a registered name and a real address appear on the site.
- `https://asc-pilot.com` in the `canonical`, `og:url` and `sitemap.xml`
  entries. Change it once you know the real domain.
- `yourbusiness.ascpilot.com` on the pricing card, if customer sites end up
  living somewhere else.

The FAQ and the legal pages state policies — support times, what counts as an
ordinary change, when a refund applies. They are drafts written to be honest and
reasonable, not legal advice. Read them as commitments you will have to keep,
and change anything you would not stand behind.

## Running it locally

```bash
python3 -m http.server 4321 --directory www
```

Then open http://localhost:4321. Clean URLs and the 404 page behave slightly
differently here than on Cloudflare, which serves `404.html` automatically.

## Deploying to Cloudflare Pages

**Drag and drop, no repository needed.** In the Cloudflare dashboard, go to
Workers and Pages, Create, Pages, "Upload assets", and drop this `www` folder in.
Every later change is another upload.

**Or from Git,** which redeploys on push:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `www` |

Either way you get `<project>.pages.dev` with HTTPS, free, on Cloudflare's free
plan. A custom domain is added under the project's Custom domains tab.

## Notes

- **No cookies, no analytics, no third party requests.** The fonts are served
  from `assets/fonts/` rather than a font host, which is why the privacy policy
  can say the page tells nobody you visited. Adding an analytics script breaks
  that claim, so update `privacy.html` if you ever do.
- **The contact form has no backend.** It validates in the browser and hands the
  message to the visitor's own mail app. Nothing to host, nothing to breach. If
  you later want submissions to arrive without the visitor's mail client, a
  Cloudflare Pages Function or a form service would replace `main.js`'s submit
  handler.
- **The price is written into `index.html`.** Unlike the generated customer
  sites, this page does not read Stripe. If the €50 changes, change it here too.
