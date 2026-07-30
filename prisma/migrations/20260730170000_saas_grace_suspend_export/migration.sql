-- AlterEnum
ALTER TYPE "SaasSubscriptionStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "SaasSubscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);
ALTER TABLE "SaasSubscription" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "SaasSubscription" ADD COLUMN "retentionEndsAt" TIMESTAMP(3);
ALTER TABLE "SaasSubscription" ADD COLUMN "dataExportDownloadedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SaasSubscription_status_pastDueSince_idx" ON "SaasSubscription"("status", "pastDueSince");
