import type { SiteGenerationInput } from "@/core/types";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { asJson } from "@/lib/json";
import { logger } from "@/lib/logger";
import { getSiteGenerator } from "@/providers/generator";
import { getHostingProvider } from "@/providers/hosting";
import { addressLines } from "@/site/i18n";
import { renderSite } from "@/site/render";
import { pickTemplate, templateByKey } from "@/site/templates";
import { variationFor } from "@/site/variation";
import { getPlan } from "@/providers/billing";

/**
 * Site generation: turn a qualified lead into a deployed preview.
 *
 * A generated site is never marked reviewed automatically. `reviewedByHuman`
 * stays false until someone looks at it, and Phase 4 must refuse to link an
 * unreviewed site in an outreach email — the whole pitch rests on the page
 * being right about a real business.
 */

const ATTRIBUTION = "Data © Overture Maps Foundation, CDLA-Permissive 2.0.";

export interface GenerateOptions {
  /** Generate for one lead. */
  slug?: string;
  /** Or for the next N qualified leads without a site. */
  limit?: number;
  /** Rebuild even if a site already exists. */
  force?: boolean;
}

export interface GenerateSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  withUnverifiedClaims: number;
  urls: Array<{
    slug: string;
    url: string;
    template: string;
    claims: number;
    usage?: { inputTokens: number; outputTokens: number };
  }>;
  /** Total tokens across the run, for cost tracking. */
  inputTokens: number;
  outputTokens: number;
}

export async function generateSites(options: GenerateOptions): Promise<GenerateSummary> {
  const leads = await prisma.lead.findMany({
    where: options.slug
      ? { slug: options.slug }
      : {
          status: { in: ["NEW", "SITE_READY"] },
          ...(options.force ? {} : { sites: { none: {} } }),
        },
    include: { business: true, sites: { orderBy: { version: "desc" }, take: 1 } },
    take: options.slug ? 1 : (options.limit ?? 5),
    orderBy: { qualifiedAt: "asc" },
  });

  const summary: GenerateSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    withUnverifiedClaims: 0,
    urls: [],
    inputTokens: 0,
    outputTokens: 0,
  };

  for (const lead of leads) {
    summary.attempted += 1;
    const log = logger.child({ leadId: lead.id, slug: lead.slug });

    try {
      const result = await generateForLead(lead.id);
      summary.succeeded += 1;
      if (result.claims > 0) summary.withUnverifiedClaims += 1;
      summary.inputTokens += result.usage?.inputTokens ?? 0;
      summary.outputTokens += result.usage?.outputTokens ?? 0;
      summary.urls.push(result);
      log.info("generation.succeeded", { url: result.url, template: result.template });
    } catch (error) {
      summary.failed += 1;
      log.error("generation.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

async function generateForLead(leadId: string) {
  const env = getEnv();

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      business: { include: { contacts: true } },
      sites: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  const business = lead.business;
  const version = (lead.sites[0]?.version ?? 0) + 1;

  const email = business.contacts.find((contact) => contact.channel === "EMAIL")?.value;
  const facebook = business.contacts.find((contact) => contact.channel === "FACEBOOK")?.value;
  const instagram = business.contacts.find((contact) => contact.channel === "INSTAGRAM")?.value;

  const site = await prisma.generatedSite.create({
    data: {
      leadId: lead.id,
      version,
      status: "GENERATING",
      generator: env.GENERATOR_PROVIDER,
      generatorModel: env.ANTHROPIC_MODEL,
    },
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { status: "SITE_GENERATING" } });

  try {
    const input: SiteGenerationInput = {
      leadId: lead.id,
      slug: lead.slug,
      locales: ["el", "en"],
      defaultLocale: "el",
      business: {
        name: business.name,
        categories: business.categories,
        primaryCategory: business.primaryCategory ?? undefined,
        address: {
          formatted: business.formattedAddress ?? undefined,
          line: business.addressLine ?? undefined,
          city: business.city ?? undefined,
          region: business.region ?? undefined,
          postalCode: business.postalCode ?? undefined,
          countryCode: business.countryCode ?? undefined,
        },
        location:
          business.latitude != null && business.longitude != null
            ? { latitude: business.latitude, longitude: business.longitude }
            : undefined,
        phone: business.phone ?? undefined,
        addressLocalized: addressLines({
          line: business.addressLine,
          city: business.city,
          postalCode: business.postalCode,
        }),
        email,
        facebook,
        instagram,
      },
    };

    const draft = await getSiteGenerator().generate(input);

    const template =
      templateByKey(draft.template) ?? pickTemplate(business.primaryCategory ?? undefined, lead.slug);

    const hosting = getHostingProvider();
    const target = { slug: lead.slug, environment: "preview" as const };

    const plan = await getPlan();

    const html = renderSite({
      content: draft.content,
      template,
      category: business.primaryCategory ?? undefined,
      variation: variationFor(lead.slug, template),
      slug: lead.slug,
      priceLabel: { el: plan.displayPriceEl, en: plan.displayPrice },
      url: hosting.urlFor(target),
      preview: true,
      attribution: ATTRIBUTION,
    });

    const deployment = await hosting.deploy(target, { "index.html": html });

    await prisma.generatedSite.update({
      where: { id: site.id },
      data: {
        status: "PREVIEW",
        template: template.key,
        content: asJson(draft.content),
        html,
        hostingProvider: deployment.provider,
        deploymentId: deployment.deploymentId,
        previewUrl: deployment.url,
        generatedAt: new Date(),
        deployedAt: new Date(),
        // Deliberately not set here — a human has to look at it first.
        reviewedByHuman: false,
        assets: asJson({
          unverifiedClaims: draft.unverifiedClaims ?? [],
          usage: draft.usage ?? null,
        }),
      },
    });

    await prisma.lead.update({ where: { id: lead.id }, data: { status: "SITE_READY" } });

    return {
      slug: lead.slug,
      url: deployment.url,
      template: template.key,
      claims: draft.unverifiedClaims?.length ?? 0,
      usage: draft.usage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.generatedSite.update({
      where: { id: site.id },
      data: { status: "FAILED", error: message },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "NEW" } });
    throw error;
  }
}
