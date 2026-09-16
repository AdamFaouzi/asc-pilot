import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import type { OpeningHour } from "@/core/types";
import { verifyOwnerToken } from "@/core/owner-token";
import { prisma } from "@/lib/db";
import { getEnv, requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { updateSiteContent } from "@/pipeline/ops";

export const dynamic = "force-dynamic";

/**
 * The business owner's own edits: photos and opening hours.
 *
 * Everything here is scoped to the slug inside the signed token, so this
 * endpoint cannot touch another business's site even if the token leaks.
 */

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 6;

function parseHours(raw: unknown): OpeningHour[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const hours: OpeningHour[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { day, open, close } = entry as Record<string, unknown>;
    if (
      typeof day !== "number" || day < 0 || day > 6 ||
      typeof open !== "string" || !/^\d{2}:\d{2}$/.test(open) ||
      typeof close !== "string" || !/^\d{2}:\d{2}$/.test(close)
    ) {
      continue;
    }
    hours.push({ day, open, close });
  }
  return hours;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = requireEnv("UNSUBSCRIBE_SECRET", "owner edit links");

  const slug = verifyOwnerToken(token, secret);
  if (!slug) return NextResponse.json({ error: "This link is not valid" }, { status: 403 });

  const site = await prisma.generatedSite.findFirst({
    where: { lead: { slug }, status: { in: ["PREVIEW", "LIVE", "NEEDS_WORK"] } },
    orderBy: { version: "desc" },
  });
  if (!site) return NextResponse.json({ error: "No site found" }, { status: 404 });

  const content = (site.content ?? {}) as Record<string, unknown>;
  const existing = (content.gallery ?? []) as Array<{ url?: string }>;
  const contentType = request.headers.get("content-type") ?? "";

  // --- Photos -------------------------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const files = form.getAll("photos").filter((entry): entry is File => entry instanceof File);
    const keep = form.getAll("keep").map(String);

    const kept = existing.map((photo) => photo.url).filter((url): url is string => Boolean(url) && keep.includes(url!));
    const room = MAX_PHOTOS - kept.length;

    const directory = path.join(process.cwd(), "public", "uploads", slug);
    await mkdir(directory, { recursive: true });

    const added: string[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const extension = ALLOWED.get(file.type);
      if (!extension) {
        return NextResponse.json({ error: "Only JPEG, PNG and WebP images are accepted" }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Each photo must be under 8 MB" }, { status: 400 });
      }
      const name = `${randomBytes(8).toString("hex")}${extension}`;
      await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
      added.push(`/uploads/${slug}/${name}`);
    }

    await updateSiteContent(site.id, { gallery: [...kept, ...added] });
    logger.info("owner.photos_updated", { slug, added: added.length, kept: kept.length });

    return NextResponse.json({ ok: true, gallery: [...kept, ...added] });
  }

  // --- Opening hours ------------------------------------------------------
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const hours = parseHours(body.hours);
  if (hours === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.generatedSite.update({
    where: { id: site.id },
    data: { content: { ...content, hours } as never },
  });
  await updateSiteContent(site.id, {});

  logger.info("owner.hours_updated", { slug, spans: hours.length });
  return NextResponse.json({ ok: true, hours });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const slug = verifyOwnerToken(token, getEnv().UNSUBSCRIBE_SECRET ?? "");
  return NextResponse.json({ valid: Boolean(slug) });
}
