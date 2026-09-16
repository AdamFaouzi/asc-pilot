-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebsiteVerdict" AS ENUM ('UNKNOWN', 'NONE', 'SOCIAL_ONLY', 'DIRECTORY_ONLY', 'HAS_WEBSITE');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'PHONE', 'INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'CONTACT_FORM');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'NEEDS_REVIEW', 'SITE_GENERATING', 'SITE_READY', 'APPROVED', 'OUTREACH_SENT', 'REPLIED', 'CONVERTED', 'DECLINED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('DRAFT', 'GENERATING', 'PREVIEW', 'LIVE', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('QUEUED', 'BLOCKED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('UNSUBSCRIBED', 'COMPLAINED', 'HARD_BOUNCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "category" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusM" INTEGER,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "businessesSeen" INTEGER NOT NULL DEFAULT 0,
    "businessesNew" INTEGER NOT NULL DEFAULT 0,
    "businessesQualified" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryCategory" TEXT,
    "formattedAddress" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "websiteUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "priceLevel" INTEGER,
    "openingHours" JSONB,
    "photos" JSONB,
    "reviews" JSONB,
    "websiteVerdict" "WebsiteVerdict" NOT NULL DEFAULT 'UNKNOWN',
    "websiteEvidence" JSONB,
    "websiteCheckedAt" TIMESTAMP(3),
    "raw" JSONB,
    "discoveryRunId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "slug" TEXT NOT NULL,
    "primaryEmail" TEXT,
    "reviewReason" TEXT,
    "notes" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_sites" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'DRAFT',
    "generator" TEXT NOT NULL,
    "generatorModel" TEXT,
    "template" TEXT,
    "content" JSONB,
    "html" TEXT,
    "assets" JSONB,
    "hostingProvider" TEXT,
    "deploymentId" TEXT,
    "previewUrl" TEXT,
    "liveUrl" TEXT,
    "customDomain" TEXT,
    "reviewedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "editedByHuman" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "generatedAt" TIMESTAMP(3),
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_log" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "siteId" TEXT,
    "channel" "OutreachChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "OutreachStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "template" TEXT,
    "unsubscribeToken" TEXT,
    "blockedReason" TEXT,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "firstOpenAt" TIMESTAMP(3),
    "firstClickAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_events" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "note" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "amountCents" INTEGER NOT NULL DEFAULT 3000,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "customerEmail" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discovery_runs_status_createdAt_idx" ON "discovery_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "businesses_websiteVerdict_idx" ON "businesses"("websiteVerdict");

-- CreateIndex
CREATE INDEX "businesses_city_primaryCategory_idx" ON "businesses"("city", "primaryCategory");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_source_sourceId_key" ON "businesses"("source", "sourceId");

-- CreateIndex
CREATE INDEX "contacts_channel_value_idx" ON "contacts"("channel", "value");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_businessId_channel_value_key" ON "contacts"("businessId", "channel", "value");

-- CreateIndex
CREATE UNIQUE INDEX "leads_businessId_key" ON "leads"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_slug_key" ON "leads"("slug");

-- CreateIndex
CREATE INDEX "leads_status_updatedAt_idx" ON "leads"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "generated_sites_status_updatedAt_idx" ON "generated_sites"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "generated_sites_leadId_version_key" ON "generated_sites"("leadId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_log_unsubscribeToken_key" ON "outreach_log"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "outreach_log_status_queuedAt_idx" ON "outreach_log"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "outreach_log_toAddress_idx" ON "outreach_log"("toAddress");

-- CreateIndex
CREATE INDEX "outreach_events_messageId_occurredAt_idx" ON "outreach_events"("messageId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "suppressions_email_key" ON "suppressions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_leadId_key" ON "subscriptions"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhook_events_provider_eventId_key" ON "processed_webhook_events"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "discovery_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_sites" ADD CONSTRAINT "generated_sites_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_log" ADD CONSTRAINT "outreach_log_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_log" ADD CONSTRAINT "outreach_log_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "generated_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "outreach_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
