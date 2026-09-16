import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Photo upload for a generated site.
 *
 * Files land in `public/uploads/<slug>/` and are served as ordinary static
 * assets. Deliberately not data URIs — a 200 KB photo becomes ~270 KB of base64
 * inlined into every render of the page, and there are up to six per site.
 *
 * These are the operator's own photographs, which is the point: no attribution
 * obligation, no expiring third-party URLs, and a picture of the actual shop.
 */

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PER_SITE = 6;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  }

  const site = await prisma.generatedSite.findFirst({
    where: { lead: { slug }, status: { in: ["PREVIEW", "NEEDS_WORK"] } },
    orderBy: { version: "desc" },
  });
  if (!site) return NextResponse.json({ error: "No editable site for this lead" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("photos").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files supplied" }, { status: 400 });

  const directory = path.join(process.cwd(), "public", "uploads", slug);
  await mkdir(directory, { recursive: true });

  const urls: string[] = [];

  for (const file of files.slice(0, MAX_PER_SITE)) {
    const extension = ALLOWED.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: `${file.name}: only JPEG, PNG and WebP are accepted` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `${file.name} is larger than 8 MB` }, { status: 400 });
    }

    // Random name: the original filename is untrusted input and could collide.
    const name = `${randomBytes(8).toString("hex")}${extension}`;
    await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
    urls.push(`/uploads/${slug}/${name}`);
  }

  logger.info("ops.photos_uploaded", { slug, count: urls.length });
  return NextResponse.json({ ok: true, urls });
}
