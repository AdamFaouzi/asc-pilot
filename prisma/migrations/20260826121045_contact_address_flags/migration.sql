-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "isFreeMailbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRoleAddress" BOOLEAN NOT NULL DEFAULT false;
