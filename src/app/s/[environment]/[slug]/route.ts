import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Serves generated sites.
 *
 * The rendered HTML is read from the database, not from disk. Both exist —
 * `LocalHostingProvider` also writes files — but the database is the copy that
 * survives deployment: on a serverless host the filesystem is ephemeral, so a
 * site written during generation is gone by the time a visitor asks for it.
 *
 * Since the outreach email's whole value is a link that works, this reads the
 * durable copy and treats the files as a local convenience.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ environment: string; slug: string }> },
) {
  const { environment, slug } = await params;

  if (!["preview", "live"].includes(environment) || !/^[a-z0-9-]+$/.test(slug)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const live = environment === "live";

  const site = await prisma.generatedSite.findFirst({
    where: {
      lead: { slug },
      status: live ? "LIVE" : { in: ["PREVIEW", "NEEDS_WORK"] },
    },
    orderBy: { version: "desc" },
    select: { html: true },
  });

  /*
   * A preview that has been bought is now LIVE, so the preview row is gone.
   * Send the visitor to the live page instead of a 404 — otherwise paying is
   * followed by "Site not found": Stripe's success_url is the preview path,
   * and the webhook has usually promoted the site before the customer's
   * browser gets back. Every preview link already sent in outreach has the
   * same problem the moment the business subscribes.
   */
  if (!site && !live) {
    const promoted = await prisma.generatedSite.findFirst({
      where: { lead: { slug }, status: "LIVE" },
      select: { id: true },
    });
    if (promoted) {
      return NextResponse.redirect(new URL(`/s/live/${slug}`, getEnv().APP_URL), 307);
    }
  }

  let html = site?.html ?? null;

  if (!html) {
    // Local development fallback: a site generated before this route changed,
    // or one written to disk without its HTML persisted.
    try {
      html = await readFile(
        path.join(process.cwd(), "generated-sites", environment, slug, "index.html"),
        "utf8",
      );
    } catch {
      return new NextResponse("Site not found", { status: 404 });
    }
  }

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Previews change as sites are regenerated; a live site can be cached
      // briefly, since a paying customer's page should be fast.
      "cache-control": live ? "public, max-age=300, s-maxage=300" : "no-store",
      ...(live ? {} : { "x-robots-tag": "noindex, nofollow" }),
    },
  });
}
