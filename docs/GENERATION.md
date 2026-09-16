# Site generation (Phase 3)

## The split: templates are code, the model writes copy

`src/site/templates/` owns layout, palette, spacing, and type. The generator
owns words and picks which template to use. Nothing generates CSS or markup at
runtime.

That split is deliberate. A model asked to emit HTML produces something slightly
different — and slightly worse — every time, and a business paying every month
should get a page that is correct by construction. Four templates keyed to
category give variety without gambling on it:

| Template | Palette | Suits |
| --- | --- | --- |
| `editorial` | Dark, warm neutral accent | Salons, spas, photographers, hotels, retail |
| `taverna` | Cream, terracotta accent | Restaurants, cafés, bars, bakeries, food shops |
| `clinic` | White, teal accent | Pharmacies, dental and medical, opticians |
| `workshop` | Near-black, amber accent | Garages, trades, gyms, hardware |

Three more — `coastal`, `market`, `study` — cover hospitality, food retail, and
professional services, for seven in total.

## Why templates alone weren't enough

The first version had four templates and one fixed sentence per slot. Every
restaurant page came out byte-identical apart from two nouns: 13 strings per
page, 8 of them chrome. Palette variety cannot disguise an identical skeleton,
and the result read as exactly what it was — mass-produced.

Variation is now several **independent** axes, each hashed separately from the
slug so they don't move together (`src/site/variation.ts`):

| Axis | Options |
| --- | --- |
| Template | 7, by category |
| Accent | 3–4 per template |
| Hero layout | centered, left, split (split moves phone and address beside the name) |
| Type scale | compact, balanced, display |
| Monogram | circle, square, rule, none — built from the business's initials |
| Rhythm | tight or airy section spacing |
| Section rules | hairline under section titles, or not |

Measured over the current previews: **14 of 14 pages have a structurally
distinct skeleton**, across 9 accents, 3 hero layouts, and 4 monogram styles.
The choice is stable per business, so regenerating never surprises an owner who
has already seen their page.

Two further things carry real per-business difference:

- **A map of the actual premises.** An OpenStreetMap embed at the business's own
  coordinates — no API key, no billing, and unlike anything else on the page it
  is genuinely unique to each business.
- **A monogram from their own initials**, skipping Greek articles so
  "Η Γωνιά του Πεπέ" reads as ΓΠ rather than ΗΓ.

## Bilingual: Greek by default, English on a toggle

Both languages are written into the document and switched with a class on
`<html>`. The toggle flips that class and stores the choice; that is the entire
mechanism. Consequences worth knowing:

- The page is fully readable with **JavaScript disabled** — Greek shows, because
  hiding English is the CSS default.
- Search engines and social previews see Greek, which is the right primary for
  a Cypriot business.
- No translation service is called when a visitor loads the page. The English is
  generated once, at build time.

Three things are translated with dictionaries rather than by the model, because
they are closed sets with checkable answers:

- **Category labels** (`Φαρμακείο` / `Pharmacy`) — `src/site/i18n.ts`.
- **Place names**, with grammatical case. `Λεμεσός` → **Limassol** in English,
  not the transliterated "Lemesos". And Greek inflects after a preposition:
  "Εστιατόριο στη Λεμεσός" is wrong, it has to be "στη Λεμεσό". A native reader
  spots that instantly, and nothing reads more mass-produced than broken
  grammar. Unknown villages get a heuristic (drop final ς, choose στη/στην).
- **Postal addresses** — only the locality is translated. Street names stay
  exactly as recorded, because a courier needs the address as written.

Business names are never translated or transliterated in the page. Getting a
real business's own name wrong is worse than leaving it as they wrote it.

## Greek slugs

A third of the businesses in the Cyprus data are named in Greek. The original
`slugify` stripped non-ASCII, which turned every one of them into `business`,
`business-2`, `business-3` — identical URLs in the one place the pitch has to
look personal. Slugs now transliterate Greek to Latin (roughly ISO 843):

```
Η Γωνιά του Πεπέ        →  i-gonia-tou-pepe
Φαρμακείο Ραφαέλα ...   →  farmakeio-rafaela-thrasyvoulidou
ΨΑΡΑΓΟΡΑ The Fish ...   →  psaragora-the-fish-busters
```

`npm run reslug` repairs existing leads after a slugify change. It refuses to
touch a lead that has already been contacted — a slug that has gone out in an
email is a live URL someone may come back to.

## The model may not invent facts

These pages go live under a real business's name, at their real address, with
their real phone number. The system prompt forbids inventing services, prices,
hours, history, awards, or quality claims, and requires anything asserted beyond
the input to be listed in `unverifiedClaims`.

Enforcement is structural, not just prompted:

- `GeneratedSite.reviewedByHuman` starts `false` and is never set automatically.
- The generation summary reports how many sites carry unverified claims.
- Phase 4 must refuse to link an unreviewed site in an outreach email.

If the model fails or its output doesn't validate, generation falls back to the
deterministic generator, which only rearranges the business's own data. A plain
correct page beats no page, and it is always safe to publish.

## What the data can't support

Overture carries no opening hours, photos, or reviews. Generated sites therefore
have no gallery, no hours table, and no testimonials — the templates render
those sections only when data exists. This is the strongest argument for paying
Google Places for *converted* customers, where the monthly revenue already
covers the Enterprise SKU call.

## Commands

```bash
npm run generate -- --limit 10                   # next 10 qualified leads
npm run generate -- --slug i-gonia-tou-pepe      # one business
npm run generate -- --slug ... --force           # new version, keeps the old one
```

Sites are written to `generated-sites/preview/<slug>/` and served at
`/s/preview/<slug>` with `noindex`. Versions are kept, so regenerating never
destroys the page that was already linked in an email.


## Category coverage

A hero reading "Τοπική επιχείρηση" — the generic fallback — is the loudest
possible signal that nobody wrote the page. `npm run coverage` reports how many
pitchable leads would get a real label and names the categories still missing:

```
Category labels: 195/197 (99.0%)
```

The last two were `beach` and `town_hall` — not businesses that can buy a
subscription at all. Those are now excluded at discovery as non-commercial
rather than given a label they don't need.

## What this still can't do

The copy is assembled from a handful of true phrasings. That is varied, correct,
and safe to publish — but it is not writing. Genuinely bespoke prose about each
business needs the Claude generator, which needs `ANTHROPIC_API_KEY`. Until then
every page is honest and visually distinct, and the words are still a template.


## Marks and category identity

The templates were professional but interchangeable — a taverna and a dental
clinic differed only in palette. Two things now carry the business's own
character:

**An emblem.** A category glyph paired with the business's initials, in the
site's accent. Two barbers get the same scissors but different letters and a
different accent, so they don't read as the same shop. Initials skip articles
*and* the category noun many Cypriot businesses lead with: "Φαρμακείο Ραφαέλα
Θρασυβουλίδου" initialises to ΡΘ, the pharmacist's name, not ΦΡ, which starts
with the word "pharmacy".

**A watermark.** The same glyph, large and faint behind the hero, bleeding off
the corner.

`npm run coverage` reports glyph coverage the same way it reports labels —
currently 195/197, the two misses being `beach` and `town_hall`, which are not
businesses that can buy anything.

### The name beats the classifier

"Greg's His and Hers Hair Salon" is filed by Overture under `beauty_salon`,
which earned it a cosmetics glyph when the name plainly says scissors. A
business names itself; a third-party classifier guesses. Where they disagree,
`categoryFromName` wins — matching Greek and English terms alike, so
`Κουρείο Ανδρέας` and `Aces Bar` both resolve correctly.

## Real logos

A generated emblem is a fallback, not a goal. Where a real logo exists it always
wins: set **Logo** on the lead's editor to any image URL or data URI, and clear
the field to fall back to the emblem.

### Applying Facebook photos in bulk

`npm run logos` fetches every business's Facebook page photo and applies it,
`--dry-run` to preview, `--clear` to undo. Two filters run automatically:

- **Facebook's default avatar** is served byte-identically to every page that
  has none, so it is caught by hash — both a known hash and any image that
  turns up for more than one business, since a shared image cannot be anyone's
  logo.
- **Failed fetches and images under 1.5 KB**, which are error pages rather than
  logos.

What no filter can catch is the difference between a logo and a photo of the
owner by a pool. Both are valid images unique to that business. So `/logos` is a
contact sheet: every image at a glance, one click to drop the ones that aren't
logos, falling back to the generated emblem.

A hotlinked logo also stays outside our control — a business can delete its
page. The generated emblem is therefore rendered alongside it, hidden, and
swapped in by an `onerror` handler. A broken image icon on someone's website is
worse than no logo.

The copyright of a Facebook photo belongs to whoever uploaded it, and Meta's
platform terms restrict reuse. Defensible on a preview the owner is being shown;
worth checking before it goes live on a page you are charging for.


## Free enrichment from OpenStreetMap

`npm run enrich:osm` matches each lead to an OSM POI — one name containing the
other, within 150 metres — and takes three things:

- **Opening hours**, which the hours section needs to render at all.
- **Amenities** (outdoor seating, step-free access, wifi, vegetarian options).
  Every one is a tag someone recorded, never inferred from the category.
- **A `website` tag**, which disqualifies the lead. Telling a business "you have
  no website" when they do is the worst outcome this pipeline has.

Two things it deliberately gets right:

**A Facebook URL in the `website` tag is not a website.** Four leads carried
`facebook.com/...` or `booking.com/...` there — which is precisely the
social-or-directory-only presence that *qualifies* a lead. The check reuses
`isSocialUrl` / `isDirectoryUrl` from the discovery code, so only a site of the
business's own disqualifies. Without that, four good leads would have been
retired.

**Hours it cannot parse are skipped, not guessed.** The grammar allows day lists
spanning commas (`Mo-Tu,Th-Fr 08:00-13:00,14:00-18:00`) alongside comma-
separated rules (`Mo-Fr 07:00-19:00, Sa 07:00-13:30`), which look identical
until you notice one half has no times in it. Anything the parser can't resolve
returns null: wrong hours on a business's own website are worse than none.

Coverage is the honest limit here — 28 of 114 leads match an OSM record at all,
and 18 carry something worth using. That is the ceiling of free data, not of the
code.
