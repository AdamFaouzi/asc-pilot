import type { Template } from "./templates";

/**
 * Per-business visual variation.
 *
 * Four templates were not enough: every page in a category shared a palette, a
 * hero layout, a type scale, and a section order, so a street of tavernas got a
 * street of identical pages. Palette alone cannot disguise an identical
 * skeleton.
 *
 * Each axis below is hashed independently from the slug, so they don't move
 * together — two businesses sharing a template will still differ in accent,
 * hero shape, and rhythm. Seven templates times the axes here is a few thousand
 * combinations, and the choice is stable: the same business always gets the
 * same page, so a regenerated site doesn't surprise an owner who has seen it.
 */

export type HeroLayout = "centered" | "left" | "split";
export type TypeScale = "compact" | "balanced" | "display";
export type MonogramStyle = "circle" | "square" | "rule" | "none";

export type Rhythm = "tight" | "airy";

/**
 * How much colour the hero commits to.
 *
 * Both options are deliberately loud. The previous design put the accent on a
 * single button and left the rest of the fold white, which reads as a software
 * company rather than a taverna.
 */
export type HeroStyle = "tint" | "solid";

export interface Variation {
  accent: string;
  accentText: string;
  heroLayout: HeroLayout;
  typeScale: TypeScale;
  monogram: MonogramStyle;
  rhythm: Rhythm;
  heroStyle: HeroStyle;
  /** Draw a hairline rule under section titles. */
  ruledSections: boolean;
}

/** FNV-1a, so different axes of the same slug land in unrelated buckets. */
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

const HERO_LAYOUTS: HeroLayout[] = ["centered", "left", "split"];
const TYPE_SCALES: TypeScale[] = ["compact", "balanced", "display"];
/*
 * "none" is deliberately absent. It was one option in four, so a quarter of
 * sites shipped with no mark at all — which reads as unfinished now that the
 * emblem carries the business's category and initials.
 */
const MONOGRAMS: MonogramStyle[] = ["circle", "square", "rule"];
const RHYTHMS: Rhythm[] = ["tight", "airy"];
const HERO_STYLES: HeroStyle[] = ["tint", "solid"];

export function variationFor(slug: string, template: Template): Variation {
  const accent = pick(slug, "accent", template.accents);

  return {
    accent: accent.value,
    accentText: accent.on,
    // The template's own alignment stays in the mix, but doesn't dominate.
    heroLayout: pick(slug, "hero", HERO_LAYOUTS),
    typeScale: pick(slug, "type", TYPE_SCALES),
    monogram: pick(slug, "monogram", MONOGRAMS),
    rhythm: pick(slug, "rhythm", RHYTHMS),
    heroStyle: pick(slug, "heroStyle", HERO_STYLES),
    ruledSections: hash(`${slug}::ruled`) % 2 === 0,
  };
}

/** Hero size per type scale, in px, from the approved scale steps. */
export const HERO_SIZE: Record<TypeScale, { mobile: number; desktop: number }> = {
  compact: { mobile: 36, desktop: 48 },
  balanced: { mobile: 48, desktop: 60 },
  display: { mobile: 48, desktop: 72 },
};

/** Vertical section padding per rhythm, from the spacing tokens. */
export const SECTION_SPACE: Record<Rhythm, number> = { tight: 48, airy: 80 };

/**
 * Initials for the monogram.
 *
 * Two kinds of word are skipped. Articles, so "Η Γωνιά του Πεπέ" reads as ΓΠ
 * rather than ΗΓ. And the category noun many Cypriot businesses lead with —
 * "Φαρμακείο Ραφαέλα Θρασυβουλίδου" should initialise to ΡΘ, the pharmacist's
 * name, not ΦΡ, which starts with the word "pharmacy".
 */
const SKIP = new Set([
  // Articles and conjunctions
  "η", "ο", "το", "του", "της", "των", "τα", "στο", "στη", "και",
  "the", "of", "and", "&", "at", "in",
  // Category nouns businesses commonly lead with
  "φαρμακείο", "ταβέρνα", "ψαροταβέρνα", "καφενείο", "καφετέρια", "εστιατόριο",
  "κομμωτήριο", "κουρείο", "ζαχαροπλαστείο", "αρτοποιείο", "φούρνος",
  "κρεοπωλείο", "ιχθυοπωλείο", "ανθοπωλείο", "βιβλιοπωλείο", "οδοντιατρείο",
  "γυμναστήριο", "ξενοδοχείο", "συνεργείο", "παντοπωλείο",
  "pharmacy", "taverna", "tavern", "restaurant", "cafe", "café", "bar", "pub",
  "bakery", "salon", "studio", "clinic", "gym", "hotel", "shop", "store",
]);

export function monogramText(name: string): string {
  const words = name
    .split(/[\s\-–—]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 0 && !SKIP.has(word.toLowerCase()));

  // If skipping left nothing, the name *is* the category word — use it.
  const source = words.length > 0 ? words : name.split(/\s+/).filter(Boolean);
  const initials = source.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");

  return initials.join("") || name.trim().charAt(0).toUpperCase();
}
