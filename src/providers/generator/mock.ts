import type { GeneratedSiteDraft, Locale, Localized, SiteGenerationInput } from "@/core/types";
import { categoryLabel, localized, LOCALES, placeName, UI } from "@/site/i18n";
import { pickTemplate } from "@/site/templates";

import type { SiteGenerator } from "./types";

/**
 * Deterministic generator: rearranges the business's own data into bilingual
 * content without a model.
 *
 * It invents nothing. Every sentence is assembled from facts the source
 * supplied — name, category, town — using fixed phrasings, so the output is
 * safe to publish for a real business straight away.
 *
 * The phrasings vary per business rather than being one fixed sentence. That is
 * not decoration: a street of tavernas whose pages all read "Εστιατόριο στη
 * Λεμεσό." announces that nobody wrote them. Varying the true statement is the
 * most this can honestly do — genuinely bespoke prose needs the model, which is
 * what the Claude generator is for.
 */

/** Stable per-business choice, independent of the visual axes. */
function hash(value: string): number {
  let total = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    total ^= value.charCodeAt(i);
    total = Math.imul(total, 0x01000193) >>> 0;
  }
  return total >>> 0;
}

function pick<T>(slug: string, axis: string, options: readonly T[]): T {
  return options[hash(`${slug}::${axis}`) % options.length]!;
}

export class MockSiteGenerator implements SiteGenerator {
  readonly key = "mock";

  async generate(input: SiteGenerationInput): Promise<GeneratedSiteDraft> {
    const { business } = input;
    const slug = input.slug;
    const category = categoryLabel(business.primaryCategory);
    const place = placeName(business.address?.city);
    const template = pickTemplate(business.primaryCategory, slug);

    // A Greek name reads fine in the English view and vice versa. Neither is
    // transliterated — getting a real business's own name wrong is worse than
    // leaving it exactly as they wrote it.
    const name = business.name;

    const subheading: Localized = place
      ? pick(slug, "sub", [
          localized(`${category.el} ${place.inPlace.el}.`, `${category.en} ${place.inPlace.en}.`),
          localized(
            `${category.el}. Θα μας βρείτε ${place.inPlace.el}.`,
            `${category.en}. You'll find us ${place.inPlace.en}.`,
          ),
          localized(
            `Είμαστε ${place.inPlace.el} και σας περιμένουμε.`,
            `We're ${place.inPlace.en}, and we'd be glad to see you.`,
          ),
          localized(
            `${place.name.el} — ${category.el.toLowerCase()}.`,
            `${place.name.en} — ${category.en.toLowerCase()}.`,
          ),
        ])
      : localized(`${category.el}.`, `${category.en}.`);

    const statement: Localized = place
      ? pick(slug, "statement", [
          localized(
            `${category.el} ${place.inPlace.el}.\nΠεράστε να μας γνωρίσετε.`,
            `${category.en} ${place.inPlace.en}.\nCome in and say hello.`,
          ),
          localized(
            `Είμαστε ${place.inPlace.el}.\nΗ πόρτα μας είναι ανοιχτή.`,
            `You'll find us ${place.inPlace.en}.\nOur door is open.`,
          ),
          localized(
            `${category.el} ${place.inPlace.el}.\nΠάρτε μας τηλέφωνο ή περάστε από κοντά.`,
            `${category.en} ${place.inPlace.en}.\nCall us, or just drop by.`,
          ),
        ])
      : localized("Περάστε να μας γνωρίσετε.", "Come in and say hello.");

    const callUs = UI.callUs ?? localized("Καλέστε μας", "Call us");
    const emailUs = UI.emailUs ?? localized("Στείλτε email", "Email us");

    const cta: Localized = business.phone
      ? pick(slug, "cta", [callUs, localized("Τηλεφωνήστε μας", "Give us a call")])
      : emailUs;

    return {
      template: template.key,
      model: "mock",
      // Nothing above is asserted beyond the source data.
      unverifiedClaims: [],
      content: {
        defaultLocale: (input.defaultLocale ?? "el") as Locale,
        locales: input.locales ?? LOCALES,
        businessName: name,
        tagline: category,
        hero: { heading: localized(name, name), subheading, ctaLabel: cta },
        statement,
        hours: business.openingHours,
        contact: {
          phone: business.phone,
          email: business.email,
          address: business.addressLocalized,
          mapQuery: business.address?.formatted ?? name,
          location: business.location,
          facebook: business.facebook,
          instagram: business.instagram,
        },
        gallery: business.photos,
        theme: { template: template.key },
      },
    };
  }
}
