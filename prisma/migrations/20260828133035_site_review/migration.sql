-- AlterEnum
ALTER TYPE "SiteStatus" ADD VALUE 'NEEDS_WORK';

-- AlterTable
ALTER TABLE "generated_sites" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
