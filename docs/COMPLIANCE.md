# Outreach compliance — open before building Phase 4

Not legal advice. This is a checklist of what to resolve, so the build doesn't
quietly assume the easy answer.

## The situation

ASC-Pilot emails businesses that never asked to hear from us, from Cyprus, mostly
to recipients in the EU. That engages two regimes at once:

- **GDPR** — a business email address that identifies a person
  (`maria@salon.com.cy`, or a sole trader's address) is personal data. A generic
  address (`info@`, `contact@`) for an incorporated company generally is not,
  though this is interpreted differently by different supervisory authorities.
- **ePrivacy / Cyprus Law 112(I)/2004 as amended** — governs unsolicited
  commercial email specifically. Article 13 of the ePrivacy Directive sets
  opt-in as the default for natural persons; member states choose the regime for
  legal persons, and Cyprus is one of the jurisdictions where B2B has more
  latitude than B2C. That latitude is not the same thing as no rules.

## Questions to answer before writing send code

1. **Which recipients count as legal persons?** The pipeline must be able to
   tell a limited company's `info@` address from a sole trader's personal one,
   because the rules differ. If it can't tell, does the lead default to manual
   review?
2. **Is legitimate interest the lawful basis, and is the balancing test written
   down?** GDPR Art. 6(1)(f) requires a documented Legitimate Interests
   Assessment. Ours is favourable-ish — the message is specific to the
   recipient's business, it is commercially relevant to them, and the volume is
   low — but it needs to exist on paper before the first send, not after a
   complaint.
3. **What does the Art. 14 notice look like?** Data was collected from a public
   source, not from the recipient, so they must be told what we hold, where it
   came from, and how to object. Usually a privacy page linked in the footer of
   every email.
4. **Is the retention period defined?** How long a non-responding lead's data is
   kept, and what deletes it.
5. **Does generating a site for a business raise anything separately?** Photos
   and reviews pulled from a listing carry the platform's licence terms and, for
   photos, third-party copyright. Google Places photo attribution requirements
   are contractual, not optional.

## Requirements the build must satisfy regardless of the answers

- Sender identity is real and accurate: legal name, and a physical postal
  address (`OUTREACH_POSTAL_ADDRESS`).
- Subject lines describe the message honestly. No fake `Re:`, no implied prior
  relationship, no invented urgency.
- A working opt-out in every message — an in-body link plus
  `List-Unsubscribe` / `List-Unsubscribe-Post` headers — that takes effect
  immediately and without requiring a reply.
- Opt-outs are honoured permanently and across campaigns. That is what the
  `suppressions` table is for: it's keyed by email, so re-discovering the same
  business later can't undo an opt-out.
- No open-tracking pixel until it's been decided whether that needs consent
  separately. It probably does.
- Sending from a dedicated domain via a transactional provider, never a personal
  mailbox — both for deliverability and so the sender is unambiguous.
- Rate limits low enough that the behaviour is nothing like a blast.

## Status

Phase 4 is **built but cannot send.** Two independent switches are both off:
`OUTREACH_ENABLED=false` in `.env`, and `npm run outreach` defaults to a dry
run that refuses `--send` unless the flag is also set. Every downstream gate has
been exercised end to end against the console provider, which logs instead of
sending.

The questions above remain open by choice — no business has been contacted, so
nothing turns on them yet. Settle them before flipping the flag; an hour with a
Cypriot lawyer is cheaper than the technical build already done.

### What the code guarantees today

| Guarantee | Where |
| --- | --- |
| Nothing sends unless two separate switches are on | `preflight`, `scripts/outreach.ts` |
| Only human-reviewed sites can be linked | `preflight` → `site_not_reviewed` |
| Only human-approved leads can be contacted | `preflight` → `lead_not_approved` |
| One message per lead, ever | `preflight` → `already_contacted` |
| Opt-outs are permanent and survive re-discovery | `suppressions`, keyed by email |
| Bounces and complaints auto-suppress | `/api/webhooks/email` |
| Every send and every block is logged before it happens | `outreach_log` |
| Rate limits are config, not constants | `OUTREACH_DAILY_LIMIT`, `OUTREACH_MIN_INTERVAL_SECONDS` |
| Unsubscribe links cannot be forged or enumerated | HMAC-signed tokens |
| Sender identity and postal address are mandatory | `requireEnv` at send time |
| One-click unsubscribe, no confirm step | `/unsubscribe` |
