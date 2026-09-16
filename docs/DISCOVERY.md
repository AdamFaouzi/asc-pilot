# Discovery (Phase 2)

## Where the data comes from

[Overture Maps](https://overturemaps.org) — an open dataset from Meta, Microsoft
and others under CDLA-Permissive 2.0. No API key, no billing account, no
per-call cost. All of Cyprus is 57,849 places in a 6.3 MB parquet file.

Google Places was the obvious alternative and is deliberately not the default.
Its `websiteUri` field — the single field this entire product depends on — sits
in Google's Enterprise SKU tier, with a free allowance of about 1,000 calls a
month. Screening at any useful volume costs real money, and the `google` adapter
remains available (`PLACES_PROVIDER=google`) for when that trade makes sense.

### What Overture does not have

Opening hours, photos, and reviews. Phase 3's generator works from name,
category, address, phone, and social links alone. If generated sites turn out to
need hours or photos, that is the argument for paying Google for *converted*
customers — where the monthly revenue already covers the call.

## Setup

```bash
npm run overture:fetch              # all of Cyprus, ~75s, writes ./data/overture
npm run discover -- --area limassol --category beauty_salon --limit 200
```

`overture:fetch` is a one-off per release. Without a local extract the provider
falls back to scanning S3 directly, which works but takes ~45s per query and
logs a warning.

Re-run it when Overture ships a release (roughly monthly): bump
`OVERTURE_RELEASE` and fetch again.

## Qualification

A missing website field in open data is a weaker signal than a missing one in
Google's. Overture inherits the field rather than maintaining it, so "no website
listed" sometimes means "nobody recorded one". Emailing a business that already
has a site is the worst possible outcome for this product — it makes the pitch
look automated and wrong — so the check is deliberately conservative.

The order of evidence:

1. **A listed website** that isn't a social or directory URL → `HAS_WEBSITE`.
   Disqualified.
2. **Only a directory URL** (Yelp, Deliveroo, a Google listing) →
   `DIRECTORY_ONLY`. Still a lead.
3. **A custom email domain** → unresolved. `info@emilysbeauty.com.cy` means
   somebody bought that domain, but a domain can serve mail without serving a
   page. This is the case the probe exists for.
4. **HTTP probe of that domain.** Serves a page → `HAS_WEBSITE`. Doesn't →
   the domain is mail-only, and the business really has no site.
5. **Social profile only** → `SOCIAL_ONLY`. The core lead.
6. **Nothing at all** → `NONE`.

The probe is the step that makes free data usable. It is roughly one HTTP
request per business with a custom email domain, and it can be turned off with
`WEBSITE_PROBE_ENABLED=false` — at which case those businesses land in
`NEEDS_REVIEW` rather than being assumed good.

Ignore Overture's `socials` field as a qualification signal: Meta is a data
contributor, so ~98% of records carry a Facebook URL. It's useful as *input* to
site generation, not as evidence about websites.

## Two scores, not one

Early on these were conflated into a single confidence number, and the result
inverted: businesses with a custom domain matching their name scored highest —
and those are exactly the businesses that already have a website. Meanwhile
every genuine lead, using a Gmail address, scored lowest. Optimising the funnel
would have meant systematically preferring the customers who don't need the
product.

So they are separate:

- **`Contact.confidence`** — will this address reach the business? A publicly
  listed address starts at 0.7 whatever its domain, because publication is what
  earns the baseline. Role prefixes and name-matching domains add a little.
  Below `CONTACT_CONFIDENCE_THRESHOLD`, the lead goes to manual review.
- **`Contact.isFreeMailbox` / `isRoleAddress`** — is emailing them a good idea?
  This is a legal question, not a deliverability one. A Gmail address is more
  likely to belong to a natural person, which changes the analysis under GDPR
  and ePrivacy. Phase 4 gates on these flags explicitly.

This is question 1 in [COMPLIANCE.md](COMPLIANCE.md) — "which recipients count
as legal persons" — made answerable in data rather than left to a judgement call
at send time.

## Nothing is dropped silently

A business we can't contact becomes a `NEEDS_REVIEW` lead with a stated reason,
never a gap in the numbers. Current reasons:

- `No contact email discovered`
- `Email confidence X below threshold Y`
- `Website check unresolved` — a custom domain that couldn't be probed

The review queue is at `/leads`.

Re-scanning is safe: a lead that has moved past discovery (approved, contacted,
converted) is never reset to `NEW` by a later run.

## Attribution

Overture requires attribution. Generated sites and any published lead data
should carry: *Data © Overture Maps Foundation, available under CDLA-Permissive
2.0.*
