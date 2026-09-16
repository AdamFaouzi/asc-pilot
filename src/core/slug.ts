/**
 * Slugs are public: they appear in the preview URL the business owner is sent,
 * so they have to read like the business's name.
 *
 * A third of the businesses in the Cyprus data are named in Greek. Stripping
 * non-ASCII would turn every one of them into "business", "business-2",
 * "business-3" — indistinguishable URLs in the one place the pitch has to look
 * personal. So Greek is transliterated to Latin rather than discarded.
 */

const MAX_LENGTH = 48;

/** Digraphs first — order matters, since these override the single-letter map. */
const GREEK_DIGRAPHS: Array<[RegExp, string]> = [
  [/ου/g, "ou"],
  [/ΟΥ/g, "OU"],
  [/Ου/g, "Ou"],
  [/αυ/g, "av"],
  [/ευ/g, "ev"],
  [/μπ/g, "b"],
  [/ντ/g, "d"],
  [/γκ/g, "gk"],
  [/γγ/g, "ng"],
  [/τσ/g, "ts"],
  [/τζ/g, "tz"],
];

const GREEK_LETTERS: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

/**
 * Greek to Latin, roughly ISO 843. Accents are already gone by this point —
 * NFKD decomposition plus combining-mark removal handles them — so only the
 * base letters need mapping.
 */
export function transliterateGreek(value: string): string {
  // Strip accents here rather than at the call site: ά and ό are distinct code
  // points from α and ο, so an un-normalised string loses every accented vowel
  // and "Κάτω Πάφος" transliterates to "Kto Pfos".
  let result = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  for (const [pattern, replacement] of GREEK_DIGRAPHS) {
    result = result.replace(pattern, replacement);
  }

  return result.replace(/[Ͱ-Ͽ]/g, (character) => {
    const lower = character.toLowerCase();
    return GREEK_LETTERS[lower] ?? "";
  });
}

export function slugify(value: string): string {
  return transliterateGreek(
    value
      .normalize("NFKD")
      // Strip combining marks so "Café" becomes "cafe" and "Πάφος" becomes "Παφος".
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase(),
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Builds a slug that does not collide, trying a hint (usually the city) before
 * falling back to a numeric suffix. `exists` is injected so this stays testable
 * without a database.
 */
export async function uniqueSlug(
  name: string,
  exists: (candidate: string) => Promise<boolean>,
  hint?: string,
): Promise<string> {
  const base = slugify(name) || "business";

  const candidates = [base];
  if (hint) {
    const withHint = slugify(`${name}-${hint}`);
    if (withHint && withHint !== base) candidates.push(withHint);
  }

  for (const candidate of candidates) {
    if (!(await exists(candidate))) return candidate;
  }

  const root = candidates[candidates.length - 1] ?? base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(`Could not find a free slug for "${name}"`);
}
