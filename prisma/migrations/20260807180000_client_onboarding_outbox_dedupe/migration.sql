-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'CLIENT_ONBOARDING_INTERNAL';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'CLIENT_ONBOARDING_CUSTOMER_CONFIRMATION';

-- AlterTable
ALTER TABLE "EmailOutbound" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbound_dedupeKey_key" ON "EmailOutbound"("dedupeKey");
