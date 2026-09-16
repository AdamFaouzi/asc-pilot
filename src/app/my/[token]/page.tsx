import { notFound } from "next/navigation";

import { verifyOwnerToken } from "@/core/owner-token";
import type { SiteContent } from "@/core/types";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { OwnerEditor } from "./OwnerEditor";

export const dynamic = "force-dynamic";

/**
 * The owner's edit page, reached by a signed link with no account behind it.
 *
 * This is where the photographs actually come from at scale. We cannot
 * photograph every shop and no API sells a good picture of a Paphos taverna —
 * but the owner has both, and once they have said yes they are motivated to
 * supply them.
 */
export default async function OwnerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = getEnv().UNSUBSCRIBE_SECRET;
  const slug = secret ? verifyOwnerToken(token, secret) : null;
  if (!slug) notFound();

  const site = await prisma.generatedSite.findFirst({
    where: { lead: { slug }, status: { in: ["PREVIEW", "LIVE", "NEEDS_WORK"] } },
    orderBy: { version: "desc" },
    include: { lead: { select: { business: { select: { name: true } } } } },
  });
  if (!site) notFound();

  const content = site.content as SiteContent | null;

  return (
    <OwnerEditor
      token={token}
      businessName={site.lead.business.name}
      previewUrl={site.liveUrl ?? site.previewUrl}
      initialGallery={(content?.gallery ?? []).map((photo) => photo.url).filter((url): url is string => Boolean(url))}
      initialHours={content?.hours ?? []}
    />
  );
}
