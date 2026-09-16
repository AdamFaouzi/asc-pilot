import { verifyUnsubscribeToken } from "@/core/unsubscribe";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * One-click opt-out.
 *
 * Deliberately has no confirm step: the recipient never asked to hear from us,
 * so making them click twice to stop is indefensible. Suppression is keyed by
 * address, so this also protects them from being re-discovered and contacted
 * again next month.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const secret = getEnv().UNSUBSCRIBE_SECRET;

  const email = t && secret ? verifyUnsubscribeToken(t, secret) : null;

  if (email) {
    await prisma.suppression.upsert({
      where: { email },
      create: { email, reason: "UNSUBSCRIBED", source: "unsubscribe_link" },
      update: {},
    });

    await prisma.lead.updateMany({
      where: { primaryEmail: email, status: { notIn: ["CONVERTED"] } },
      data: { status: "DECLINED", reviewReason: "Unsubscribed" },
    });

    logger.info("outreach.unsubscribed", { email });
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      {email ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Σας διαγράψαμε</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">
            Δεν θα λάβετε άλλο μήνυμα από εμάς στο{" "}
            <span className="font-mono text-ink-200">{email}</span>.
          </p>
          <hr className="my-8 border-ink-800" />
          <h2 className="text-lg font-medium">You&rsquo;re unsubscribed</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            You won&rsquo;t hear from us again at{" "}
            <span className="font-mono text-ink-200">{email}</span>. Nothing else is needed.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Μη έγκυρος σύνδεσμος</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">
            This unsubscribe link is invalid or has expired. Reply to the email you received and
            we&rsquo;ll remove you by hand.
          </p>
        </>
      )}
    </main>
  );
}
