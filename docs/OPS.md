# Ops (Phase 6)

## Where to look

| Page | For |
| --- | --- |
| `/` | Funnel, MRR, recent scans, integration status |
| `/sites` | Search and browse every generated site, step through with ↑↓ |
| `/review` | Swipe through unreviewed sites, accept or send back |
| `/leads` | Filterable list — ready, site built, needs review, all |
| `/leads/<slug>` | Everything about one lead, plus every manual action |

## Browsing vs reviewing

`/review` is a decision queue: unreviewed sites only, and every visit changes
state. `/sites` is for looking — search across name, category, town, template
and status, then step through the matches with ↑↓ (or `j`/`k`), `/` to jump back
to the search box. Nothing there changes anything.

Search terms are ANDed, so "paphos bar" narrows rather than widens. Only the
newest version of each site is listed, since that's the one worth looking at.

## The funnel counts stages *reached*

A lead that converted has also been contacted, so it is counted at both stages.
Counting leads *currently sitting in* a status instead produces conversion rates
above 100% as soon as anyone moves through, which is why the funnel sums
onward statuses rather than reading a single one.

The percentage beside each row is conversion from the stage above, so the
bottleneck is the row where the number collapses.

## Manual interventions

All on `/leads/<slug>`:

- **Approve site** — the same action as the review deck.
- **Send back for work** — records why, and the note stays attached to the
  version that caused it.
- **Regenerate site** — builds a new version. Old versions are kept, so a page
  already linked in an email is never destroyed.
- **Edit copy** — see below.
- **Retry failed send** — clears a `FAILED` message so the lead can be picked up
  again. Deliberately refuses `BLOCKED` messages: those were stopped by a rule,
  and retrying one means overriding the rule rather than fixing an error.
- **Mark bad / duplicate** — requires a reason, and archives any preview so a
  disqualified lead's page stops being reachable at a URL that may already have
  been sent.
- **Restore** — returns the lead to whatever stage its evidence supports
  (`APPROVED` if its site was reviewed, `SITE_READY` if built, else `NEW`),
  rather than blindly to the top.
- **Never contact** — adds a permanent suppression by email address.

A lead that has already converted cannot be disqualified from here; cancel the
subscription in Stripe instead, and the webhook takes the site down.

## Where photos come from

Not from us. We cannot photograph 114 shops, and no API sells a decent picture
of a Paphos taverna: Google Places needs billing that may not clear, and
Mapillary's imagery is CC BY-SA — share-alike is the wrong licence to put on a
paying client's commercial site, quite apart from it being blurry pavement-angle
shots with cars in them.

The owner has the photos, on their phone, and cares more than we do. So the
preview's job is to earn a reply, and pictures arrive afterwards.

Each lead has a signed **owner link** on its detail page (`/my/<token>`). Send
it once they say yes: no account, no password, works on a phone, in Greek and
English. They add photos and set opening hours; the site re-renders immediately.
The token is scoped to one slug, so a leaked link can only ever touch that one
site — verified by attempting a forged slug against a valid signature.

This is the only part of the pipeline that scales to photographs, because it is
the only part where someone is motivated to supply them.

## Photos, added by you

Upload your own on the lead page: *Edit copy* → **Photos**. Up to six JPEG/PNG/
WebP files, saved to `public/uploads/<slug>/` and served as static assets — not
inlined as data URIs, since a 200 KB photo becomes ~270 KB of base64 in every
render and there can be six per site. The first photo runs wide across the
gallery; the rest tile beside it.

Your own photographs are the best source available, and not just because Google
billing may not work: there is no attribution obligation, no third-party URL to
expire, and the picture is genuinely of that shop. For a local operator pitching
local businesses, walking past with a phone beats any API.

Uploads are gitignored.

## Editing a site's copy

Only text is editable. Layout, palette, and structure stay with the templates,
so an edit cannot produce a broken page. Saving re-renders and redeploys.

**Editing clears the review.** The lead drops from `APPROVED` back to
`SITE_READY` and the site is marked unreviewed, because the previous approval
described a page that no longer exists. Without that, you could approve a page,
change what it says, and still send it — which is the one failure this whole
review step exists to prevent.

Live sites cannot be edited in place: a paying customer's page needs a fresh
version rather than a silent rewrite.
