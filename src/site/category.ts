/**
 * Overture's categories are more specific than anything we need to branch on:
 * `greek_restaurant`, `irish_pub`, `french_restaurant`, `boxing_class`. Exact
 * matching against a list therefore misses most real records and quietly sends
 * a taverna to the wrong template with a generic label.
 *
 * This reduces a specific category to a base one we have a label and a template
 * for, using the fact that Overture composes them as `<qualifier>_<base>`.
 */

/** Base categories, longest first so `coffee_shop` wins over `shop`. */
const BASES = [
  "dental_clinic",
  "beauty_salon",
  "hair_salon",
  "nail_salon",
  "coffee_shop",
  "grocery_store",
  "clothing_store",
  "jewelry_store",
  "furniture_store",
  "hardware_store",
  "mobile_phone_store",
  "pet_store",
  "gas_station",
  "car_wash",
  "automotive_repair",
  "travel_agency",
  "guest_house",
  "ice_cream_shop",
  "fast_food_restaurant",
  "wine_bar",
  "health_care",
  "restaurant",
  "taverna",
  "pharmacy",
  "bakery",
  "butcher",
  "fishmonger",
  "florist",
  "bookstore",
  "optician",
  "physiotherapist",
  "veterinarian",
  "photographer",
  "locksmith",
  "electrician",
  "plumber",
  "laundry",
  "dentist",
  "doctor",
  "hotel",
  "pizzeria",
  "cafe",
  "pub",
  "bar",
  "gym",
  "spa",
  "massage",
  "preschool",
  "nursery_school",
  "retirement_home",
  "printing_service",
  "tattoo_and_piercing",
  "dance_club",
  "souvenir_store",
  "christian_place_of_worship",
  "real_estate",
  "insurance_agency",
  "accounting",
  "lawyer",
  "school",
  "music_venue",
  "sports_and_recreation",
  "hostel",
  "lounge",
  "cocktail_bar",
  "beach_bar",
  "juice_bar",
  "karaoke_venue",
  "car_rental_service",
  "department_store",
  "gymnastics_center",
  "food_and_drink",
] as const;

/** Specific categories whose base is not a suffix of their own name. */
const ALIASES: Record<string, string> = {
  boxing_class: "gym",
  fitness_center: "gym",
  martial_arts_club: "gym",
  yoga_studio: "gym",
  barber: "hair_salon",
  barber_shop: "hair_salon",
  hairdresser: "hair_salon",
  tavern: "taverna",
  bistro: "restaurant",
  brewery: "bar",
  night_club: "bar",
  cafeteria: "cafe",
  coffee: "cafe",
  medical_clinic: "health_care",
  hospital: "health_care",
  drugstore: "pharmacy",
  car_repair: "automotive_repair",
  auto_repair: "automotive_repair",
  supermarket: "grocery_store",
  mini_market: "grocery_store",
  convenience_store: "grocery_store",
  fashion_boutique: "clothing_store",
  hookah_bar: "bar",
  night_club_bar: "bar",
  kindergarten: "preschool",
  reproductive_perinatal_and_womens_care: "health_care",
  womens_health_clinic: "health_care",
  gift_shop: "souvenir_store",
  jewelry_and_watches_manufacturer: "jewelry_store",
  gymnastics_club: "gymnastics_center",
};

/**
 * Reduces an Overture category to a base we recognise, or returns undefined
 * when there is genuinely no match — callers must handle that rather than
 * guessing.
 */
export function baseCategory(category: string | undefined): string | undefined {
  if (!category) return undefined;

  const key = category.toLowerCase();

  if (ALIASES[key]) return ALIASES[key];
  if ((BASES as readonly string[]).includes(key)) return key;

  // `greek_restaurant` → `restaurant`, `irish_pub` → `pub`.
  const suffixMatch = BASES.find((base) => key.endsWith(`_${base}`));
  if (suffixMatch) return suffixMatch;

  // `restaurant_greek` → `restaurant`.
  const prefixMatch = BASES.find((base) => key.startsWith(`${base}_`));
  if (prefixMatch) return prefixMatch;

  return undefined;
}

/**
 * Best base category from everything the source told us: the primary category
 * first, then alternates, then the coarse `basic_category`.
 */
export function resolveCategory(
  primary: string | undefined,
  all: string[] = [],
): string | undefined {
  return baseCategory(primary) ?? all.map(baseCategory).find(Boolean);
}

/**
 * Categories that are places, not businesses. A beach and a town hall both turn
 * up in the places data and both pass the "no website" filter, but neither can
 * buy a subscription at any price — so they are excluded at discovery rather than
 * left to waste a slot in the review queue.
 */
const NON_COMMERCIAL = new Set([
  "beach",
  "town_hall",
  "park",
  "playground",
  "cemetery",
  "government_office",
  "embassy",
  "courthouse",
  "police_station",
  "fire_station",
  "post_office",
  "monument",
  "bus_station",
  "bus_stop",
  "parking_lot",
  "parking",
  "atm",
  "public_restroom",
  "hiking_trail",
  "scenic_point",
]);

export function isNonCommercial(category: string | undefined, all: string[] = []): boolean {
  const candidates = [category, ...all].filter((value): value is string => Boolean(value));
  return candidates.some((value) => NON_COMMERCIAL.has(value.toLowerCase()));
}
