import { escapeHtml } from "./html";
import { glyphFor, glyphSvg } from "./glyphs";
import type { MonogramStyle } from "./variation";

/**
 * The mark at the top of a generated site.
 *
 * Order of preference:
 *   1. The business's own logo, if we have one. Nothing generated beats it.
 *   2. A generated emblem: the category glyph paired with their initials.
 *
 * The emblem exists because a page with no mark at all reads as a document
 * rather than a business. Pairing the glyph with initials makes it specific:
 * two barbers get the same scissors but different letters, and the accent
 * differs per business, so they don't look like the same shop.
 */

export interface EmblemInput {
  businessName: string;
  initials: string;
  category?: string;
  style: MonogramStyle;
  logoUrl?: string;
}

export function renderEmblem({
  businessName,
  initials,
  category,
  style,
  logoUrl,
}: EmblemInput): string {
  const glyph = glyphSvg(glyphFor(category, businessName), 22);

  /*
   * A hotlinked logo is outside our control — a business can delete its page
   * and the image 404s. So the generated emblem is rendered alongside it,
   * hidden, and swapped in if the image fails to load. A broken image icon on
   * someone's website is worse than no logo at all.
   */
  if (logoUrl) {
    const fallbackStyle = style === "none" ? "circle" : style;
    return `<div class="emblem emblem-logo">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(businessName)}" loading="eager"
           onerror="this.parentElement.classList.add('logo-failed')" />
      <span class="emblem emblem-${fallbackStyle} emblem-fallback" aria-hidden="true">
        <span class="emblem-glyph">${glyph}</span>
        <span class="emblem-initials">${escapeHtml(initials)}</span>
      </span>
    </div>`;
  }

  if (style === "none") return "";

  // The rule variant reads as a wordmark, the others as a badge.
  if (style === "rule") {
    return `<div class="emblem emblem-rule" aria-hidden="true">
      <span class="emblem-glyph">${glyph}</span>
      <span class="emblem-initials">${escapeHtml(initials)}</span>
    </div>`;
  }

  return `<div class="emblem emblem-${style}" aria-hidden="true">
    <span class="emblem-glyph">${glyph}</span>
    <span class="emblem-initials">${escapeHtml(initials)}</span>
  </div>`;
}

/** A large, faint glyph sitting behind the hero — category as atmosphere. */
export function renderWatermark(category: string | undefined, businessName?: string): string {
  return `<div class="watermark" aria-hidden="true">${glyphSvg(
    glyphFor(category, businessName),
    420,
    0.5,
  )}</div>`;
}
