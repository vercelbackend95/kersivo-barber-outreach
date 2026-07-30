-- AlterEnum
ALTER TYPE "SaasSubscriptionStatus" ADD VALUE 'PAST_DUE';
ALTER TYPE "SaasSubscriptionStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "SaasSubscription" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "SaasSubscription" ADD COLUMN "shopId" TEXT;
ALTER TABLE "SaasSubscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SaasSubscription" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "SaasSubscription" ADD COLUMN "canceledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SaasSubscription_stripeCustomerId_idx" ON "SaasSubscription"("stripeCustomerId");
CREATE INDEX "SaasSubscription_shopId_idx" ON "SaasSubscription"("shopId");
