import type { Locale, Localized } from "@/core/types";

import { transliterateGreek } from "@/core/slug";

import { baseCategory } from "./category";

/**
 * Greek/English strings for generated sites.
 *
 * Cyprus is bilingual in practice: Greek for residents, English for the expat
 * and tourist trade. Both languages are rendered into the page and toggled with
 * CSS, so the site is fully readable with JavaScript disabled and no
 * translation service is involved at view time.
 *
 * Category labels live here rather than coming from the model because they are
 * a closed set with correct, checkable translations. Asking a model to
 * translate "pharmacy" on every generation would be slower, cost money, and
 * occasionally be wrong.
 */

export const DEFAULT_LOCALE: Locale = "el";
export const LOCALES: Locale[] = ["el", "en"];

export function localized(el: string, en: string): Localized {
  return { el, en };
}

/** Chrome and section labels used by every template. */
export const UI: Record<string, Localized> = {
  about: localized("Σχετικά με εμάς", "About us"),
  services: localized("Υπηρεσίες", "Services"),
  hours: localized("Ώρες λειτουργίας", "Opening hours"),
  contact: localized("Επικοινωνία", "Contact"),
  findUs: localized("Πού θα μας βρείτε", "Find us"),
  callUs: localized("Καλέστε μας", "Call us"),
  emailUs: localized("Στείλτε email", "Email us"),
  directions: localized("Οδηγίες", "Directions"),
  followUs: localized("Ακολουθήστε μας", "Follow us"),
  latest: localized("Τα νέα μας", "Latest from us"),
  whatPeopleSay: localized("Τι λένε οι πελάτες μας", "What people say"),
  goodToKnow: localized("Χρήσιμες πληροφορίες", "Good to know"),
  openInMaps: localized("Άνοιγμα στους χάρτες", "Open in maps"),
  closed: localized("Κλειστά", "Closed"),
  switchLanguage: localized("English", "Ελληνικά"),
};

export const DAYS: Record<Locale, string[]> = {
  el: ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

/**
 * Overture category → display label. Keys are Overture's `taxonomy.primary`
 * values as they actually appear in the Cyprus extract.
 */
const CATEGORIES: Record<string, Localized> = {
  // Food and drink
  restaurant: localized("Εστιατόριο", "Restaurant"),
  cafe: localized("Καφετέρια", "Café"),
  coffee_shop: localized("Καφεκοπτείο", "Coffee shop"),
  bar: localized("Μπαρ", "Bar"),
  pub: localized("Παμπ", "Pub"),
  bakery: localized("Φούρνος", "Bakery"),
  taverna: localized("Ταβέρνα", "Taverna"),
  fast_food_restaurant: localized("Ταχυφαγείο", "Fast food"),
  pizzeria: localized("Πιτσαρία", "Pizzeria"),
  ice_cream_shop: localized("Παγωτατζίδικο", "Ice cream shop"),
  fishmonger: localized("Ιχθυοπωλείο", "Fishmonger"),
  butcher: localized("Κρεοπωλείο", "Butcher"),
  grocery_store: localized("Παντοπωλείο", "Grocery store"),
  wine_bar: localized("Οινομαγειρείο", "Wine bar"),
  lounge: localized("Lounge bar", "Lounge bar"),
  cocktail_bar: localized("Κοκτέιλ μπαρ", "Cocktail bar"),
  beach_bar: localized("Beach bar", "Beach bar"),
  juice_bar: localized("Μπαρ χυμών", "Juice bar"),

  // Beauty and wellbeing
  beauty_salon: localized("Ινστιτούτο αισθητικής", "Beauty salon"),
  hair_salon: localized("Κομμωτήριο", "Hair salon"),
  barber: localized("Κουρείο", "Barber shop"),
  barber_shop: localized("Κουρείο", "Barber shop"),
  nail_salon: localized("Ονυχοπλαστική", "Nail salon"),
  spa: localized("Σπα", "Spa"),
  gym: localized("Γυμναστήριο", "Gym"),
  massage: localized("Μασάζ", "Massage"),

  // Health
  pharmacy: localized("Φαρμακείο", "Pharmacy"),
  dental_clinic: localized("Οδοντιατρείο", "Dental clinic"),
  dentist: localized("Οδοντίατρος", "Dentist"),
  doctor: localized("Ιατρείο", "Doctor"),
  health_care: localized("Υπηρεσίες υγείας", "Health care"),
  optician: localized("Οπτικά", "Optician"),
  physiotherapist: localized("Φυσιοθεραπευτήριο", "Physiotherapy"),
  veterinarian: localized("Κτηνιατρείο", "Veterinary clinic"),

  // Trades and services
  automotive_repair: localized("Συνεργείο αυτοκινήτων", "Car repair"),
  car_wash: localized("Πλυντήριο αυτοκινήτων", "Car wash"),
  gas_station: localized("Πρατήριο καυσίμων", "Petrol station"),
  laundry: localized("Καθαριστήριο", "Laundry"),
  locksmith: localized("Κλειδαράς", "Locksmith"),
  electrician: localized("Ηλεκτρολόγος", "Electrician"),
  plumber: localized("Υδραυλικός", "Plumber"),
  florist: localized("Ανθοπωλείο", "Florist"),
  photographer: localized("Φωτογράφος", "Photographer"),

  // Retail
  bookstore: localized("Βιβλιοπωλείο", "Bookshop"),
  clothing_store: localized("Κατάστημα ρούχων", "Clothing shop"),
  jewelry_store: localized("Κοσμηματοπωλείο", "Jewellery shop"),
  mobile_phone_store: localized("Κατάστημα κινητής τηλεφωνίας", "Mobile phone shop"),
  furniture_store: localized("Κατάστημα επίπλων", "Furniture shop"),
  hardware_store: localized("Σιδηρικά", "Hardware shop"),
  pet_store: localized("Κατάστημα ζώων", "Pet shop"),

  // Kids, education, care
  preschool: localized("Νηπιαγωγείο", "Preschool"),
  nursery_school: localized("Παιδικός σταθμός", "Nursery school"),
  school: localized("Σχολείο", "School"),
  retirement_home: localized("Στέγη ηλικιωμένων", "Retirement home"),
  child_care: localized("Παιδική φροντίδα", "Child care"),

  // Other services
  printing_service: localized("Τυπογραφείο", "Printing service"),
  tattoo_and_piercing: localized("Στούντιο τατουάζ", "Tattoo studio"),
  dance_club: localized("Κλαμπ", "Club"),
  hookah_bar: localized("Χουκά μπαρ", "Hookah bar"),
  fashion_boutique: localized("Μπουτίκ", "Boutique"),
  souvenir_store: localized("Κατάστημα σουβενίρ", "Souvenir shop"),
  music_venue: localized("Μουσική σκηνή", "Music venue"),
  karaoke_venue: localized("Καραόκε", "Karaoke bar"),
  car_rental_service: localized("Ενοικιάσεις αυτοκινήτων", "Car rental"),
  department_store: localized("Πολυκατάστημα", "Department store"),
  gymnastics_center: localized("Κέντρο γυμναστικής", "Gymnastics centre"),
  food_and_drink: localized("Τρόφιμα και ποτά", "Food and drink"),
  sports_and_recreation: localized("Αθλητικός χώρος", "Sports and recreation"),
  hostel: localized("Ξενώνας", "Hostel"),
  christian_place_of_worship: localized("Εκκλησία", "Church"),
  real_estate: localized("Κτηματομεσιτικό γραφείο", "Estate agency"),
  insurance_agency: localized("Ασφαλιστικό γραφείο", "Insurance agency"),
  accounting: localized("Λογιστικό γραφείο", "Accountants"),
  lawyer: localized("Δικηγορικό γραφείο", "Law firm"),

  // Hospitality
  hotel: localized("Ξενοδοχείο", "Hotel"),
  guest_house: localized("Ξενώνας", "Guest house"),
  travel_agency: localized("Ταξιδιωτικό γραφείο", "Travel agency"),
};

const GENERIC = localized("Τοπική επιχείρηση", "Local business");

/**
 * True when we have no real Greek label for this category and would fall back
 * to "Τοπική επιχείρηση". Surfaced by the generator so a generic hero shows up
 * as a number to fix, rather than quietly shipping on someone's website.
 */
export function hasCategoryLabel(category: string | undefined): boolean {
  if (!category) return false;
  return Boolean(CATEGORIES[category] ?? CATEGORIES[baseCategory(category) ?? ""]);
}

/** Human label for an Overture category, falling back to a tidied-up key. */
export function categoryLabel(category: string | undefined): Localized {
  if (!category) return GENERIC;

  const known = CATEGORIES[category] ?? CATEGORIES[baseCategory(category) ?? ""];
  if (known) return known;

  // Unknown category: title-case the key for English, and stay generic in
  // Greek rather than machine-translating something we can't verify.
  const english = category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return localized(GENERIC.el, english);
}

/** Does this string contain Greek characters? */
export function isGreek(value: string): boolean {
  return /[Ͱ-Ͽἀ-῿]/.test(value);
}

/**
 * Place names, with the grammatical case Greek actually needs.
 *
 * Two things go wrong if you store only the nominative. English speakers search
 * for "Limassol", not the transliterated "Lemesos" — so known places are mapped
 * explicitly. And Greek inflects after a preposition: "Εστιατόριο στη Λεμεσός"
 * is wrong; it has to be "στη Λεμεσό". A native reader spots that immediately,
 * and nothing reads more mass-produced than a page with broken grammar.
 */
interface Place {
  /** Nominative — how the place is named on its own. */
  el: string;
  /** The full prepositional phrase: "in <place>". */
  elIn: string;
  en: string;
}

const PLACES: Record<string, Place> = {
  Λεμεσός: { el: "Λεμεσός", elIn: "στη Λεμεσό", en: "Limassol" },
  Λεμεσού: { el: "Λεμεσός", elIn: "στη Λεμεσό", en: "Limassol" },
  Πάφος: { el: "Πάφος", elIn: "στην Πάφο", en: "Paphos" },
  Πάφου: { el: "Πάφος", elIn: "στην Πάφο", en: "Paphos" },
  Λευκωσία: { el: "Λευκωσία", elIn: "στη Λευκωσία", en: "Nicosia" },
  Λάρνακα: { el: "Λάρνακα", elIn: "στη Λάρνακα", en: "Larnaca" },
  Αμμόχωστος: { el: "Αμμόχωστος", elIn: "στην Αμμόχωστο", en: "Famagusta" },
  Παραλίμνι: { el: "Παραλίμνι", elIn: "στο Παραλίμνι", en: "Paralimni" },
  "Αγία Νάπα": { el: "Αγία Νάπα", elIn: "στην Αγία Νάπα", en: "Ayia Napa" },
  Πρωταράς: { el: "Πρωταράς", elIn: "στον Πρωταρά", en: "Protaras" },
  Πόλις: { el: "Πόλις", elIn: "στην Πόλη", en: "Polis" },
  Πέγεια: { el: "Πέγεια", elIn: "στην Πέγεια", en: "Peyia" },
  Χλώρακας: { el: "Χλώρακας", elIn: "στον Χλώρακα", en: "Chlorakas" },
  Γερμασόγεια: { el: "Γερμασόγεια", elIn: "στη Γερμασόγεια", en: "Germasogeia" },
  Επισκοπή: { el: "Επισκοπή", elIn: "στην Επισκοπή", en: "Episkopi" },
  Μουτταγιάκα: { el: "Μουτταγιάκα", elIn: "στη Μουτταγιάκα", en: "Mouttagiaka" },
  Κύπρος: { el: "Κύπρος", elIn: "στην Κύπρο", en: "Cyprus" },
};

/** "στην" before a vowel or a stop cluster, "στη" otherwise. */
function greekPreposition(word: string): string {
  return /^[αάεέηήιίοόυύωώΑΆΕΈΗΉΙΊΟΌΥΎΩΏ]/.test(word) ||
    /^(κ|π|τ|ξ|ψ|μπ|ντ|γκ)/i.test(word)
    ? "στην"
    : "στη";
}

/**
 * Nominative to accusative for the common Cypriot endings. Names in -ς drop it
 * (Λεμεσός → Λεμεσό); names in -α/-η/-ι/-ο are already right.
 */
function greekAccusative(word: string): string {
  return word.endsWith("ς") ? word.slice(0, -1) : word;
}

/** Title-cases a transliterated place name: "kato pafos" → "Kato Pafos". */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export interface PlaceNames {
  /** Nominative, both languages. */
  name: Localized;
  /** "in <place>", correctly inflected. */
  inPlace: Localized;
}

export function placeName(place: string | undefined): PlaceNames | undefined {
  if (!place) return undefined;

  const trimmed = place.trim();

  const known = PLACES[trimmed];
  if (known) {
    return {
      name: localized(known.el, known.en),
      inPlace: localized(known.elIn, `in ${known.en}`),
    };
  }

  if (!isGreek(trimmed)) {
    return {
      name: localized(trimmed, trimmed),
      inPlace: localized(`${greekPreposition(trimmed)} ${trimmed}`, `in ${trimmed}`),
    };
  }

  const latin = titleCase(transliterateGreek(trimmed.toLowerCase()));
  const accusative = greekAccusative(trimmed);

  return {
    name: localized(trimmed, latin),
    inPlace: localized(`${greekPreposition(accusative)} ${accusative}`, `in ${latin}`),
  };
}

/**
 * Builds a postal address in both languages from its parts, translating only
 * the locality. Street names stay exactly as recorded — a courier needs the
 * address as written, not a translation of it.
 */
export function addressLines(parts: {
  line?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): Localized | undefined {
  const city = placeName(parts.city ?? undefined);

  const build = (locale: Locale) =>
    [parts.line, city?.name[locale], parts.postalCode].filter(Boolean).join(", ");

  const el = build("el");
  const en = build("en");

  return el || en ? localized(el, en) : undefined;
}


/**
 * Amenity labels.
 *
 * Keys correspond to OpenStreetMap tags that someone has actually recorded for
 * the business — so every line here is a fact with a source, not an inference
 * from its category.
 */
const AMENITIES: Record<string, Localized> = {
  outdoor_seating: localized("Τραπέζια σε εξωτερικό χώρο", "Outdoor seating"),
  wheelchair: localized("Πρόσβαση για ΑμεΑ", "Step-free access"),
  internet_access: localized("Δωρεάν Wi-Fi", "Free Wi-Fi"),
  air_conditioning: localized("Κλιματισμός", "Air conditioning"),
  takeaway: localized("Πακέτο σε πακέτο", "Takeaway"),
  delivery: localized("Διανομή κατ' οίκον", "Delivery"),
  "diet:vegetarian": localized("Χορτοφαγικές επιλογές", "Vegetarian options"),
  "diet:vegan": localized("Vegan επιλογές", "Vegan options"),
  smoking: localized("Χώρος καπνιζόντων", "Smoking area"),
  "payment:cards": localized("Δεκτές κάρτες", "Cards accepted"),
  dog: localized("Δεκτά κατοικίδια", "Dogs welcome"),
  reservation: localized("Δεκτές κρατήσεις", "Reservations taken"),
};

export function amenityLabel(key: string): Localized | undefined {
  return AMENITIES[key];
}
