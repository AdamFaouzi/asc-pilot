import type { GeneratedSiteDraft, SiteGenerationInput } from "@/core/types";

/**
 * Turns a business's public data into a presentable site.
 *
 * Implementations must only use facts present in `input`. Inventing services,
 * prices, or history would put false claims on a real business's website, so
 * anything the generator asserts beyond the input belongs in
 * `unverifiedClaims` for a human to confirm.
 */
export interface SiteGenerator {
  readonly key: string;

  generate(input: SiteGenerationInput): Promise<GeneratedSiteDraft>;
}
