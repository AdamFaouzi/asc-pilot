/**
 * Provider-neutral domain shapes.
 *
 * These are the only types the pipeline passes around. Each provider adapter
 * translates its vendor payload into these, so swapping Google Places for
 * another source (or Resend for another sender) never reaches business logic.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface Address {
  formatted?: string;
  line?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface OpeningHour {
  /** 0 = Sunday .. 6 = Saturday. */
  day: number;
  /** "HH:mm", 24-hour. */
  open: string;
  close: string;
}

export interface PlacePhoto {
  /** Provider-specific reference, or a direct URL when one is available. */
  reference: string;
  url?: string;
  widthPx?: number;
  heightPx?: number;
  /** Attribution text the provider requires us to display. */
  attribution?: string;
}

export interface PlaceReview {
  author?: string;
  rating?: number;
  text?: string;
  publishedAt?: string;
}

/** A business as returned by a places provider, normalised. */
export interface PlaceResult {
  /** Provider key, e.g. "google_places". */
  source: string;
  /** Provider's stable id for this business. */
  sourceId: string;

  name: string;
  categories: string[];
  primaryCategory?: string;

  address?: Address;
  location?: GeoPoint;

  phone?: string;
  /** Present means the business already has a site — usually disqualifying. */
  websiteUrl?: string;

  rating?: number;
  reviewCount?: number;
  priceLevel?: number;

  openingHours?: OpeningHour[];
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];

  /** Publicly listed contact emails, when the source carries them. */
  emails?: string[];
  /** All listed phone numbers; `phone` is the primary one. */
  phones?: string[];
  /** Social profile URLs (Facebook, Instagram) — not a website. */
  socials?: string[];
  /** Source's own confidence that this business exists, 0..1. */
  confidence?: number;

  /** Untouched vendor payload, stored so re-parsing costs no API calls. */
  raw?: unknown;
}

export interface DiscoveryQuery {
  /** Free text as the operator typed it, e.g. "Limassol, Cyprus". */
  area: string;
  /** Provider category filter. Omit to scan broadly. */
  category?: string;
  /** Explicit centre point; providers geocode `area` when this is absent. */
  center?: GeoPoint;
  radiusMeters?: number;
  /** Resolved search box. Bulk-dataset providers filter on this directly. */
  bbox?: BoundingBox;
  /** Soft cap so an exploratory scan can't burn the API budget. */
  limit?: number;
}

/** Everything the site generator is allowed to know about a business. */
export interface SiteGenerationInput {
  leadId: string;
  slug: string;
  /** Locales the generated content must cover. */
  locales?: Locale[];
  defaultLocale?: Locale;
  business: {
    name: string;
    categories: string[];
    primaryCategory?: string;
    address?: Address;
    location?: GeoPoint;
    phone?: string;
    openingHours?: OpeningHour[];
    photos?: PlacePhoto[];
    reviews?: PlaceReview[];
    rating?: number;
    reviewCount?: number;
    email?: string;
    /** Pre-built bilingual postal address. */
    addressLocalized?: Localized;
    facebook?: string;
    instagram?: string;
  };
  /** Layout/theme variant, so two salons on the same street differ visibly. */
  template?: string;
}

/** Languages a generated site ships in. Greek is the default in Cyprus. */
export type Locale = "el" | "en";

/**
 * A string in every locale the site ships in. Both are rendered into the page
 * and toggled client-side, so the site works without JavaScript and needs no
 * translation service at view time.
 */
export type Localized = Record<Locale, string>;

export interface LocalizedService {
  name: Localized;
  description?: Localized;
  price?: string;
}

/** Structured content a generated site renders from. */
export interface SiteContent {
  defaultLocale: Locale;
  locales: Locale[];

  /** Proper noun — never translated, only transliterated if the source is. */
  businessName: string;
  /** Latin transliteration when the name is in Greek, for the English view. */
  businessNameLatin?: string;

  tagline?: Localized;
  hero: { heading: Localized; subheading?: Localized; ctaLabel?: Localized };
  about?: Localized;
  /** The large-type moment partway down the page. */
  statement?: Localized;

  services?: LocalizedService[];
  highlights?: Localized[];
  hours?: OpeningHour[];

  contact?: {
    phone?: string;
    email?: string;
    /** Postal address. Localized because Cypriot localities are stored in Greek. */
    address?: Localized;
    mapQuery?: string;
    /** Real coordinates, for the map embed. */
    location?: GeoPoint;
    facebook?: string;
    instagram?: string;
  };

  gallery?: PlacePhoto[];
  testimonials?: Array<{ quote: Localized; author?: string }>;

  /**
   * The business's own logo, when we have one. A real logo always beats a
   * generated mark, so this wins over the emblem whenever it is set.
   * Absolute URL, or a data: URI for something uploaded by hand.
   */
  logoUrl?: string;

  /**
   * Verifiable facts about the place — outdoor seating, step-free access, wifi.
   * Sourced, never inferred: each one comes from a tag someone recorded.
   */
  amenities?: string[];

  /** Palette/type choices the template applies. */
  theme?: { template?: string; accent?: string };
}

export interface GeneratedSiteDraft {
  content: SiteContent;
  /** Rendered markup when the generator emits it directly. */
  html?: string;
  template?: string;
  model?: string;
  /** Anything the generator asserted but could not source — needs review. */
  unverifiedClaims?: string[];
  /** Token spend, when the generator is a model. Lets cost be measured. */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface DeployTarget {
  slug: string;
  /** PREVIEW deploys go to the preview domain; LIVE deploys to the real one. */
  environment: "preview" | "live";
  customDomain?: string;
}

export interface DeployResult {
  provider: string;
  deploymentId: string;
  url: string;
}

export interface OutreachEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  /** Populates the List-Unsubscribe header alongside the in-body link. */
  unsubscribeUrl: string;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  provider: string;
  providerMessageId?: string;
  acceptedAt: Date;
}
