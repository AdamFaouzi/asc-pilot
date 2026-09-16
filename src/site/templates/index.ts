import type { SiteContent } from "@/core/types";

import { baseCategory } from "../category";

/**
 * Templates are code, not model output.
 *
 * The generator supplies copy and picks a variant; the layout, spacing, and
 * type scale are fixed here. That split is deliberate: a model asked to emit
 * CSS produces something different and slightly worse every time, whereas a
 * business paying a monthly fee should get a page that is correct by construction.
 */

export interface Accent {
  value: string;
  /** Text colour that sits on the accent. */
  on: string;
}

export interface Palette {
  /** Page background. Flat — never a gradient. */
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  /** Hero heading gradient endpoints, per the visual system. */
  headingFrom: string;
  headingTo: string;
  scheme: "light" | "dark";
}

export interface Template {
  key: string;
  label: string;
  palette: Palette;
  /** Accent options; one is chosen per business so a category isn't monotone. */
  accents: Accent[];
  /** Categories this template suits best. */
  suits: string[];
  /** Hero alignment — the most visible difference between variants. */
  heroAlign: "center" | "left";
  /** Corner radius token in px, per the radius rules. */
  radius: number;
}

export const TEMPLATES: Template[] = [
  {
    key: "editorial",
    label: "Editorial",
    heroAlign: "center",
    radius: 16,
    suits: ["beauty_salon", "hair_salon", "nail_salon", "spa", "massage", "photographer", "jewelry_store", "clothing_store", "tattoo_and_piercing", "dance_club"],
    accents: [
      { value: "#E8C9A0", on: "#181818" },
      { value: "#D7B7C4", on: "#181818" },
      { value: "#B8C9BD", on: "#181818" },
      { value: "#C9BBE0", on: "#181818" },
    ],
    palette: {
      scheme: "dark",
      bg: "#000000",
      surface: "#181818",
      border: "#272727",
      text: "#FFFFFF",
      muted: "#9B9B9B",
      accent: "#E8C9A0",
      accentText: "#181818",
      headingFrom: "#FFFFFF",
      headingTo: "#9B9B9B",
    },
  },
  {
    key: "taverna",
    label: "Taverna",
    heroAlign: "left",
    radius: 12,
    suits: ["restaurant", "taverna", "cafe", "coffee_shop", "bar", "pub", "bakery", "wine_bar", "cocktail_bar", "juice_bar", "pizzeria", "fast_food_restaurant"],
    accents: [
      { value: "#9C5A2C", on: "#FFFFFF" },
      { value: "#7A6A2F", on: "#FFFFFF" },
      { value: "#A8452F", on: "#FFFFFF" },
      { value: "#4F6B52", on: "#FFFFFF" },
    ],
    palette: {
      scheme: "light",
      bg: "#FBF7F0",
      surface: "#FFFFFF",
      border: "#E5DCCD",
      text: "#1F1B16",
      muted: "#6B6156",
      accent: "#9C5A2C",
      accentText: "#FFFFFF",
      headingFrom: "#1F1B16",
      headingTo: "#6B6156",
    },
  },
  {
    key: "clinic",
    label: "Clinic",
    heroAlign: "left",
    radius: 8,
    suits: ["pharmacy", "dental_clinic", "dentist", "doctor", "health_care", "optician", "physiotherapist", "veterinarian", "retirement_home", "preschool", "nursery_school", "school", "accounting", "insurance_agency", "lawyer"],
    accents: [
      { value: "#1B6E8C", on: "#FFFFFF" },
      { value: "#2E7D64", on: "#FFFFFF" },
      { value: "#3B5FA8", on: "#FFFFFF" },
      { value: "#6B5CA5", on: "#FFFFFF" },
    ],
    palette: {
      scheme: "light",
      bg: "#FFFFFF",
      surface: "#F5F8FA",
      border: "#DDE6EC",
      text: "#0F1F2A",
      muted: "#5A6B78",
      accent: "#1B6E8C",
      accentText: "#FFFFFF",
      headingFrom: "#0F1F2A",
      headingTo: "#5A6B78",
    },
  },
  {
    key: "workshop",
    label: "Workshop",
    heroAlign: "left",
    radius: 4,
    suits: ["automotive_repair", "car_wash", "gas_station", "hardware_store", "locksmith", "electrician", "plumber", "gym"],
    accents: [
      { value: "#E5A93C", on: "#131209" },
      { value: "#C7523B", on: "#FFFFFF" },
      { value: "#5B8FA8", on: "#131209" },
      { value: "#8FA83C", on: "#131209" },
    ],
    palette: {
      scheme: "dark",
      bg: "#131209",
      surface: "#1F1F1F",
      border: "#313131",
      text: "#FFFFFF",
      muted: "#9B9B9B",
      accent: "#E5A93C",
      accentText: "#131209",
      headingFrom: "#FFFFFF",
      headingTo: "#9B9B9B",
    },
  },
  {
    key: "coastal",
    label: "Coastal",
    heroAlign: "center",
    radius: 24,
    suits: ["hotel", "guest_house", "hostel", "travel_agency", "bar", "ice_cream_shop", "wine_bar", "music_venue", "lounge", "beach_bar", "karaoke_venue"],
    accents: [
      { value: "#2C6E8F", on: "#FFFFFF" },
      { value: "#3E8C86", on: "#FFFFFF" },
      { value: "#C58A4E", on: "#FFFFFF" },
    ],
    palette: {
      scheme: "light",
      bg: "#F4F8FA",
      surface: "#FFFFFF",
      border: "#D8E4EA",
      text: "#12242E",
      muted: "#5B7484",
      accent: "#2C6E8F",
      accentText: "#FFFFFF",
      headingFrom: "#12242E",
      headingTo: "#5B7484",
    },
  },
  {
    key: "market",
    label: "Market",
    heroAlign: "left",
    radius: 8,
    suits: ["grocery_store", "butcher", "fishmonger", "bakery", "florist", "pet_store", "hardware_store"],
    accents: [
      { value: "#3F7A3F", on: "#FFFFFF" },
      { value: "#B5452C", on: "#FFFFFF" },
      { value: "#9A7A1F", on: "#FFFFFF" },
    ],
    palette: {
      scheme: "light",
      bg: "#FFFDF7",
      surface: "#F6F1E4",
      border: "#E2D9C3",
      text: "#231F16",
      muted: "#6A6151",
      accent: "#3F7A3F",
      accentText: "#FFFFFF",
      headingFrom: "#231F16",
      headingTo: "#6A6151",
    },
  },
  {
    key: "study",
    label: "Study",
    heroAlign: "left",
    radius: 2,
    suits: ["bookstore", "travel_agency", "photographer", "optician", "furniture_store", "mobile_phone_store", "laundry", "printing_service", "real_estate", "souvenir_store", "christian_place_of_worship", "department_store"],
    accents: [
      { value: "#7A3B2E", on: "#FFFFFF" },
      { value: "#2F4858", on: "#FFFFFF" },
      { value: "#5C5230", on: "#FFFFFF" },
    ],
    palette: {
      scheme: "light",
      bg: "#F7F5F1",
      surface: "#FFFFFF",
      border: "#DFD9D0",
      text: "#1C1A17",
      muted: "#6A635A",
      accent: "#7A3B2E",
      accentText: "#FFFFFF",
      headingFrom: "#1C1A17",
      headingTo: "#6A635A",
    },
  },
];

const FALLBACK = TEMPLATES[0]!;

/** Stable hash so the same business always gets the same variant. */
function hash(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    total = (total * 31 + value.charCodeAt(i)) >>> 0;
  }
  return total;
}

/**
 * Picks a template by category, and where several suit the category equally,
 * varies by slug — so two salons on the same street don't ship the same page.
 */
export function pickTemplate(category: string | undefined, slug: string): Template {
  // Overture categories are specific (`irish_pub`, `greek_restaurant`), so
  // match on the normalised base rather than the raw value.
  const base = baseCategory(category);
  const matching = base ? TEMPLATES.filter((template) => template.suits.includes(base)) : [];

  if (matching.length > 0) {
    return matching[hash(slug) % matching.length]!;
  }

  // No category match: spread across all templates rather than defaulting all
  // uncategorised businesses onto one look.
  return TEMPLATES[hash(slug) % TEMPLATES.length] ?? FALLBACK;
}

export function templateByKey(key: string | undefined): Template | undefined {
  return TEMPLATES.find((template) => template.key === key);
}

export function templateFor(content: SiteContent, slug: string, category?: string): Template {
  return templateByKey(content.theme?.template) ?? pickTemplate(category, slug);
}
