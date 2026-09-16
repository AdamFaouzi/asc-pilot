import { baseCategory } from "./category";

/**
 * Category glyphs.
 *
 * The templates were professional but interchangeable: a taverna and a dental
 * clinic differed only in palette. A mark that says what the business actually
 * *is* does more for "this was made for us" than another accent colour.
 *
 * Paths are drawn on a 24×24 grid, stroked rather than filled so they inherit
 * weight from the page and stay legible at both emblem and watermark size.
 */

export interface Glyph {
  /** SVG path data on a 0 0 24 24 viewBox. */
  d: string;
  /** Extra elements (circles etc.) that a path alone can't express. */
  extra?: string;
}

const GLYPHS: Record<string, Glyph> = {
  restaurant: { d: "M6 3v8a2 2 0 0 0 4 0V3M8 11v10M18 3c-1.5 1.5-2 3.5-2 5.5S16.5 12 18 12v9" },
  taverna: { d: "M6 3v8a2 2 0 0 0 4 0V3M8 11v10M18 3c-1.5 1.5-2 3.5-2 5.5S16.5 12 18 12v9" },
  cafe: { d: "M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2a2.5 2.5 0 0 1 0 5h-2M6 3v2M10 3v2M14 3v2" },
  coffee_shop: { d: "M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2a2.5 2.5 0 0 1 0 5h-2M6 3v2M10 3v2M14 3v2" },
  bar: { d: "M4 4h16l-8 8v8M8 20h8M4 4l3 3h10l3-3" },
  pub: { d: "M6 5h9v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V5ZM15 8h3v4a2 2 0 0 1-2 2h-1M7 2v2M11 2v2" },
  bakery: { d: "M3 13c0-4 2-7 4-7s2 2 5 2 3-2 5-2 4 3 4 7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM9 9v8M15 9v8" },
  butcher: { d: "M5 4h8v7H5zM13 6h4a3 3 0 0 1 0 6h-4M9 11v9" },
  fishmonger: { d: "M3 12c4-5 10-5 14 0-4 5-10 5-14 0ZM17 12l4-3v6l-4-3", extra: '<circle cx="8" cy="11" r="1" fill="currentColor" stroke="none"/>' },
  grocery_store: { d: "M3 5h2l2 10h11l2-7H6M9 19h.01M17 19h.01" },
  pharmacy: { d: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z" },
  dental_clinic: { d: "M6 4c2-1 4 0 6 0s4-1 6 0c2 1 1 5 0 9s-1 8-3 8-1-5-3-5-1 5-3 5-2-4-3-8-2-8 0-9Z" },
  health_care: { d: "M12 21C7 17 3 13.5 3 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 2.5c0 4-4 7.5-9 11.5Z" },
  optician: { d: "M2 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0ZM14 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0ZM10 12h4" },
  gym: { d: "M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" },
  hair_salon: { d: "M7 6 17 18M17 6 7 18", extra: '<circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/>' },
  beauty_salon: { d: "M12 3c2 4 5 5 5 9a5 5 0 0 1-10 0c0-4 3-5 5-9ZM12 21v-4" },
  spa: { d: "M12 21c0-5 3-9 8-10-1 6-4 10-8 10ZM12 21c0-5-3-9-8-10 1 6 4 10 8 10ZM12 21V11" },
  automotive_repair: { d: "M3 14h18M5 14l2-6h10l2 6M5 14v3M19 14v3", extra: '<circle cx="8" cy="17.5" r="1.6"/><circle cx="16" cy="17.5" r="1.6"/>' },
  gas_station: { d: "M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 8h6M16 10h3v7a2 2 0 0 1-4 0" },
  hotel: { d: "M3 18V8M3 13h12a4 4 0 0 1 4 4v1M21 18v-4", extra: '<circle cx="7.5" cy="10" r="2"/>' },
  bookstore: { d: "M4 4h7v16H4zM13 4h7v16h-7zM7 8h1M16 8h1" },
  florist: { d: "M12 12V21M12 12c-3 0-4-2-4-4s2-3 4-3 4 1 4 3-1 4-4 4ZM12 15c-3-1-5 0-6 2M12 15c3-1 5 0 6 2", extra: '<circle cx="12" cy="9" r="1.6" fill="currentColor" stroke="none"/>' },
  clothing_store: { d: "M9 3 5 6l2 3 1-1v12h8V8l1 1 2-3-4-3-2 2h-2Z" },
  jewelry_store: { d: "M5 9h14l-7 11ZM5 9l3-5h8l3 5M9 4l-1 5M15 4l1 5" },
  souvenir_store: { d: "M3 9h18v3H3zM4 12v9h16v-9M12 9v12M8 9c-2 0-3-1-3-2.5S6 4 8 4s4 3 4 5M16 9c2 0 3-1 3-2.5S18 4 16 4s-4 3-4 5" },
  mobile_phone_store: { d: "M7 2h10v20H7zM11 18h2" },
  photographer: { d: "M3 8h4l2-3h6l2 3h4v12H3z", extra: '<circle cx="12" cy="13" r="3.6"/>' },
  preschool: { d: "M12 3 2 8l10 5 10-5ZM6 11v5c0 2 3 3 6 3s6-1 6-3v-5" },
  laundry: { d: "M4 3h16v18H4zM7 6h2M12 6h.01", extra: '<circle cx="12" cy="14" r="4.5"/>' },
  travel_agency: { d: "M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20", extra: '<circle cx="12" cy="12" r="9.5"/>' },
  printing_service: { d: "M7 8V3h10v5M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 15h10v6H7z" },
  pet_store: { d: "M12 14c-3 0-5 2-5 4s2 3 5 3 5-1 5-3-2-4-5-4Z", extra: '<circle cx="6.5" cy="10" r="2"/><circle cx="17.5" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/>' },
  hardware_store: { d: "M14 6a4 4 0 0 0-5.5 5L3 16.5 6.5 20l5.5-5.5A4 4 0 0 0 17 9l-2.5.5L13 8l.5-2.5Z" },
  music_venue: { d: "M9 18V6l11-2v12M9 10l11-2", extra: '<circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/>' },
  ice_cream_shop: { d: "M8 10h8l-4 11ZM8 10a4 4 0 0 1 8 0" },
  car_rental_service: { d: "M3 14h18M5 14l2-6h10l2 6M5 14v3M19 14v3", extra: '<circle cx="8" cy="17.5" r="1.6"/><circle cx="16" cy="17.5" r="1.6"/>' },
};

// New shapes.
GLYPHS.fast_food_restaurant = { d: "M3 11a9 9 0 0 1 18 0ZM2 14h20a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3ZM5 20h14" };
GLYPHS.dance_club = { d: "M12 3v6M8.5 4.5l7 3M15.5 4.5l-7 3", extra: '<circle cx="12" cy="13" r="7.5"/><path d="M5 11h14M6 16h12"/>' };
GLYPHS.karaoke_venue = { d: "M12 14V5a2.5 2.5 0 0 1 5 0v9a2.5 2.5 0 0 1-5 0ZM9 12v2a5.5 5.5 0 0 0 11 0v-2M14.5 19.5V22M11 22h7" };
GLYPHS.tattoo_and_piercing = { d: "M3 21l3-1 11-11-2-2L4 18ZM15 7l2 2M17 5l4 4-2 2-4-4Z" };
GLYPHS.school = { d: "M12 3 2 8l10 5 10-5ZM6 11v5c0 2 3 3 6 3s6-1 6-3v-5M20 9v6" };
GLYPHS.retirement_home = { d: "M3 11 12 4l9 7M5 10v10h14V10", extra: '<path d="M12 18c-2-1.5-3-2.7-3-4a1.8 1.8 0 0 1 3-1 1.8 1.8 0 0 1 3 1c0 1.3-1 2.5-3 4Z"/>' };
GLYPHS.department_store = { d: "M6 8h12l1 13H5ZM9 8V6a3 3 0 0 1 6 0v2" };
GLYPHS.christian_place_of_worship = { d: "M12 3v18M8 8h8M6 21V12l6-4 6 4v9" };

// Aliases: the same shape, because these really are the same thing.
GLYPHS.cocktail_bar = GLYPHS.bar!;
GLYPHS.lounge = GLYPHS.bar!;
GLYPHS.beach_bar = GLYPHS.bar!;
GLYPHS.juice_bar = GLYPHS.cafe!;
GLYPHS.hostel = GLYPHS.hotel!;
GLYPHS.guest_house = GLYPHS.hotel!;
GLYPHS.gymnastics_center = GLYPHS.gym!;
GLYPHS.sports_and_recreation = GLYPHS.gym!;
GLYPHS.food_and_drink = GLYPHS.restaurant!;
GLYPHS.pizzeria = GLYPHS.restaurant!;
GLYPHS.wine_bar = GLYPHS.bar!;
GLYPHS.nursery_school = GLYPHS.preschool!;
GLYPHS.barber = GLYPHS.hair_salon!;
GLYPHS.nail_salon = GLYPHS.beauty_salon!;
GLYPHS.massage = GLYPHS.spa!;
GLYPHS.doctor = GLYPHS.health_care!;
GLYPHS.dentist = GLYPHS.dental_clinic!;
GLYPHS.veterinarian = GLYPHS.pet_store!;
GLYPHS.physiotherapist = GLYPHS.health_care!;
GLYPHS.car_wash = GLYPHS.automotive_repair!;
GLYPHS.furniture_store = GLYPHS.hardware_store!;
GLYPHS.locksmith = GLYPHS.hardware_store!;
GLYPHS.electrician = GLYPHS.hardware_store!;
GLYPHS.plumber = GLYPHS.hardware_store!;
GLYPHS.real_estate = GLYPHS.hotel!;
GLYPHS.accounting = GLYPHS.printing_service!;
GLYPHS.insurance_agency = GLYPHS.printing_service!;
GLYPHS.lawyer = GLYPHS.printing_service!;
GLYPHS.fashion_boutique = GLYPHS.clothing_store!;

/** Fallback: a storefront. Says "local business" without pretending to know more. */
const GENERIC: Glyph = { d: "M3 9l2-5h14l2 5M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" };

/**
 * Words in a business's own name that say what it is, in Greek and English.
 *
 * A business names itself; a third-party classifier guesses. "Greg's His and
 * Hers Hair Salon" is filed by Overture under `beauty_salon`, which earns it a
 * cosmetics glyph — when the name says, plainly, scissors. Where the two
 * disagree, the name wins.
 */
const NAME_HINTS: Array<[RegExp, string]> = [
  [/κουρ(ει|εί)|barber/i, "hair_salon"],
  [/κομμωτ|hair\s*(salon|studio|design)|hairdress/i, "hair_salon"],
  [/νυχι|nail(s)?\b/i, "beauty_salon"],
  [/ταβέρν|ψαροταβ|taverna|tavern\b|seafood|fish\s*tavern/i, "taverna"],
  [/ιχθυοπωλ|fish\s*(shop|market)|fishmonger/i, "fishmonger"],
  [/φούρν|αρτοπ|bakery|bakehouse|pastry|ζαχαροπλ/i, "bakery"],
  [/καφ(ε|έ)|coffee|espresso|cafe|caffe/i, "cafe"],
  [/παγωτ|gelat|ice\s*cream/i, "ice_cream_shop"],
  [/μπαρ\b|\bbar\b|pub\b|cocktail|lounge/i, "bar"],
  [/φαρμακ|pharmac|chemist/i, "pharmacy"],
  [/οδοντ|dental|dentist/i, "dental_clinic"],
  [/γυμναστ|\bgym\b|fitness|crossfit/i, "gym"],
  [/κρεοπωλ|butcher/i, "butcher"],
  [/ανθοπωλ|florist|flower/i, "florist"],
  [/βιβλιοπωλ|book\s*(shop|store)/i, "bookstore"],
  [/συνεργε(ι|ί)|garage|auto\s*(repair|service)|tyre|tire/i, "automotive_repair"],
  [/ξενοδοχ|hotel|resort|apartments/i, "hotel"],
  [/κοσμηματ|jewel/i, "jewelry_store"],
  [/φωτογραφ|photo(graphy|grapher)/i, "photographer"],
  [/tattoo|piercing/i, "tattoo_and_piercing"],
  [/pizz/i, "restaurant"],
  [/εστιατ|restaurant|grill|kitchen|kebab|steakhouse/i, "restaurant"],
];

/** The category a business's own name implies, if any. */
export function categoryFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return NAME_HINTS.find(([pattern]) => pattern.test(name))?.[1];
}

/**
 * The glyph for a business. The name is consulted first — it is the business's
 * own account of what it is, and it beats a third-party classification.
 */
export function glyphFor(category: string | undefined, businessName?: string): Glyph {
  const fromName = categoryFromName(businessName);
  if (fromName && GLYPHS[fromName]) return GLYPHS[fromName]!;

  if (!category) return GENERIC;
  return GLYPHS[category] ?? GLYPHS[baseCategory(category) ?? ""] ?? GENERIC;
}

export function hasGlyph(category: string | undefined, businessName?: string): boolean {
  const fromName = categoryFromName(businessName);
  if (fromName && GLYPHS[fromName]) return true;
  if (!category) return false;
  return Boolean(GLYPHS[category] ?? GLYPHS[baseCategory(category) ?? ""]);
}

/** Renders a glyph as inline SVG at the given pixel size. */
export function glyphSvg(glyph: Glyph, size: number, strokeWidth = 1.5): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyph.d}"/>${glyph.extra ?? ""}</svg>`;
}
