/**
 * Seeds the mock places fixtures through the same shape discovery will produce,
 * so the dashboard and, later, the generator have something to work with before
 * any API key exists. Safe to re-run: everything upserts.
 */
import "dotenv/config";

import { WebsiteVerdict } from "../src/generated/prisma";
import { prisma } from "../src/lib/db";
import { asJson } from "../src/lib/json";
import { slugify } from "../src/core/slug";
import { MockPlacesProvider } from "../src/providers/places/mock";

async function main() {
  const provider = new MockPlacesProvider();

  const run = await prisma.discoveryRun.create({
    data: {
      provider: provider.key,
      area: "Limassol, Cyprus",
      status: "COMPLETED",
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  let seen = 0;
  let qualified = 0;

  for await (const place of provider.search({ area: "Limassol, Cyprus" })) {
    seen += 1;

    const verdict = place.websiteUrl ? WebsiteVerdict.HAS_WEBSITE : WebsiteVerdict.NONE;

    const business = await prisma.business.upsert({
      where: { source_sourceId: { source: place.source, sourceId: place.sourceId } },
      create: {
        source: place.source,
        sourceId: place.sourceId,
        name: place.name,
        categories: place.categories,
        primaryCategory: place.primaryCategory,
        formattedAddress: place.address?.formatted,
        addressLine: place.address?.line,
        city: place.address?.city,
        postalCode: place.address?.postalCode,
        countryCode: place.address?.countryCode,
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        phone: place.phone,
        websiteUrl: place.websiteUrl,
        rating: place.rating,
        reviewCount: place.reviewCount,
        openingHours: asJson(place.openingHours),
        reviews: asJson(place.reviews),
        websiteVerdict: verdict,
        websiteCheckedAt: new Date(),
        discoveryRunId: run.id,
      },
      update: { lastSeenAt: new Date(), websiteVerdict: verdict, discoveryRunId: run.id },
    });

    // Only businesses without a site of their own become leads.
    if (verdict !== WebsiteVerdict.HAS_WEBSITE) {
      qualified += 1;
      await prisma.lead.upsert({
        where: { businessId: business.id },
        create: {
          businessId: business.id,
          slug: slugify(place.name),
          status: "NEW",
          qualifiedAt: new Date(),
        },
        update: {},
      });
    }
  }

  await prisma.discoveryRun.update({
    where: { id: run.id },
    data: { businessesSeen: seen, businessesNew: seen, businessesQualified: qualified },
  });

  console.log(`Seeded ${seen} businesses, ${qualified} qualified as leads.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
