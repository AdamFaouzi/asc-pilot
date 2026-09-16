import type { Prisma } from "@/generated/prisma";

/**
 * Prisma's `InputJsonValue` requires a structural index signature, which the
 * domain interfaces in `src/core/types.ts` deliberately don't have — they're
 * meant to be precise, not JSON-shaped. Everything we persist to a Json column
 * is already plain data, so widen it here at the boundary rather than loosening
 * the domain types.
 *
 * Returns `undefined` for nullish input so the field is simply omitted from the
 * write instead of being set to JSON null.
 */
export function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
}
