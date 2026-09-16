import { z } from "zod";

/**
 * Environment configuration.
 *
 * Only `DATABASE_URL` is required to boot, so Phase 1 runs before any third
 * party account exists. Everything else is optional here and fetched through a
 * `require*` accessor at the point of use — a missing key then fails loudly,
 * naming the variable and the phase that needs it, instead of silently sending
 * requests with a placeholder.
 */

/**
 * `.env.example` ships every optional key with an empty value, so an unset
 * integration arrives as `""` rather than as a missing key. Blank has to mean
 * "not configured", otherwise a freshly copied .env fails validation.
 */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  }, schema.optional());
}

const optionalString = optional(z.string().trim().min(1));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Core -----------------------------------------------------------------
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  /** Public origin of the ASC-Pilot app itself, used to build absolute links. */
  APP_URL: z.url().default("http://localhost:3000"),
  /** Apex domain preview sites live under, e.g. "sites.ascpilot.com". */
  PREVIEW_DOMAIN: z.string().default("localhost:3000"),

  // --- Discovery (Phase 2) --------------------------------------------------
  /** `overture` is free and needs no key; `google` bills per call. */
  PLACES_PROVIDER: z.enum(["overture", "google", "mock"]).default("overture"),
  GOOGLE_PLACES_API_KEY: optionalString,

  /** Overture release to read, e.g. "2026-08-19.0". */
  OVERTURE_RELEASE: z.string().default("2026-08-19.0"),
  /** Where `npm run overture:fetch` writes local extracts. */
  OVERTURE_DATA_DIR: z.string().default("./data/overture"),
  /** Overture's existence score; below this a record is too doubtful to pitch. */
  OVERTURE_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),

  GEOCODE_PROVIDER: z.enum(["static", "nominatim"]).default("static"),
  /** Nominatim's usage policy requires an identifying UA with a contact address. */
  NOMINATIM_USER_AGENT: optionalString,

  /**
   * Secondary check: probe the domain of a business's email to see whether it
   * actually serves a site. Catches businesses whose website the dataset simply
   * doesn't know about, which is the main weakness of free places data.
   */
  WEBSITE_PROBE_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  WEBSITE_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  WEBSITE_PROBE_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // --- Site generation (Phase 3) -------------------------------------------
  GENERATOR_PROVIDER: z.enum(["claude", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),

  // --- Hosting (Phase 3) ----------------------------------------------------
  HOSTING_PROVIDER: z.enum(["local", "vercel"]).default("local"),
  VERCEL_TOKEN: optionalString,
  VERCEL_PROJECT_ID: optionalString,
  VERCEL_TEAM_ID: optionalString,

  // --- Outreach (Phase 4) ---------------------------------------------------
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: optionalString,
  RESEND_WEBHOOK_SECRET: optionalString,
  OUTREACH_FROM_EMAIL: optional(z.email()),
  OUTREACH_FROM_NAME: z.string().default("ASC-Pilot"),
  OUTREACH_REPLY_TO: optional(z.email()),
  /** Postal address required in commercial email under EU/ePrivacy rules. */
  OUTREACH_POSTAL_ADDRESS: optionalString,
  /** Signs unsubscribe tokens so opt-out links can't be forged or enumerated. */
  UNSUBSCRIBE_SECRET: optionalString,

  // --- Billing (Phase 5) ----------------------------------------------------
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  /** Price id for the subscription plan. The amount lives on the Stripe Price. */
  STRIPE_PRICE_ID: optionalString,

  // --- Safety rails ---------------------------------------------------------
  /**
   * Master switch for anything that leaves the building. Kept off by default:
   * Phase 4 must not be able to email a real business because someone ran a
   * script locally.
   */
  OUTREACH_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  /** Upper bound on outreach emails per day, across all leads. */
  OUTREACH_DAILY_LIMIT: z.coerce.number().int().positive().default(25),
  /** Minimum seconds between two sends, to stay well clear of blast patterns. */
  OUTREACH_MIN_INTERVAL_SECONDS: z.coerce.number().int().nonnegative().default(120),
  /** Contacts below this confidence go to manual review instead of automation. */
  CONTACT_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the values.`);
  }

  return parsed.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= load();
  return cached;
}

/**
 * Reads a variable that is optional at boot but mandatory for the feature
 * about to run. `feature` shows up in the error so the fix is obvious.
 */
export function requireEnv<K extends keyof Env>(key: K, feature: string): NonNullable<Env[K]> {
  const value = getEnv()[key];

  if (value === undefined || value === null || value === "") {
    throw new Error(`${String(key)} is not set, but ${feature} needs it. Add it to .env (see .env.example).`);
  }

  return value as NonNullable<Env[K]>;
}

/** Which integrations are wired up — powers the dashboard's setup checklist. */
export function integrationStatus() {
  const env = getEnv();

  return [
    {
      key: "database",
      label: "Postgres",
      phase: 1,
      configured: Boolean(env.DATABASE_URL),
      vars: ["DATABASE_URL"],
    },
    {
      key: "places",
      label: `Places (${env.PLACES_PROVIDER})`,
      phase: 2,
      configured: env.PLACES_PROVIDER !== "google" || Boolean(env.GOOGLE_PLACES_API_KEY),
      vars: ["PLACES_PROVIDER", "GOOGLE_PLACES_API_KEY"],
    },
    {
      key: "generator",
      label: `Site generator (${env.GENERATOR_PROVIDER})`,
      phase: 3,
      configured: env.GENERATOR_PROVIDER === "mock" || Boolean(env.ANTHROPIC_API_KEY),
      vars: ["GENERATOR_PROVIDER", "ANTHROPIC_API_KEY"],
    },
    {
      key: "hosting",
      label: `Hosting (${env.HOSTING_PROVIDER})`,
      phase: 3,
      configured: env.HOSTING_PROVIDER === "local" || Boolean(env.VERCEL_TOKEN),
      vars: ["HOSTING_PROVIDER", "VERCEL_TOKEN", "VERCEL_PROJECT_ID"],
    },
    {
      key: "email",
      label: `Email (${env.EMAIL_PROVIDER})`,
      phase: 4,
      configured:
        env.EMAIL_PROVIDER === "console" ||
        Boolean(env.RESEND_API_KEY && env.OUTREACH_FROM_EMAIL && env.UNSUBSCRIBE_SECRET),
      vars: ["EMAIL_PROVIDER", "RESEND_API_KEY", "OUTREACH_FROM_EMAIL", "UNSUBSCRIBE_SECRET"],
    },
    {
      key: "billing",
      label: "Stripe",
      phase: 5,
      configured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.STRIPE_WEBHOOK_SECRET),
      vars: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"],
    },
  ] as const;
}
