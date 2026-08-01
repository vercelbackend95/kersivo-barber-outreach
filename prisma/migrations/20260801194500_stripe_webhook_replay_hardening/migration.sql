-- AlterTable ShopSettings
ALTER TABLE "ShopSettings" ADD COLUMN "connectStatusEventAt" TIMESTAMP(3);

-- AlterTable SaasSubscription
ALTER TABLE "SaasSubscription" ADD COLUMN "lastStripeEventAt" TIMESTAMP(3);
ALTER TABLE "SaasSubscription" ADD COLUMN "lastStripeEventId" TEXT;

-- AlterTable StripeWebhookEvent
ALTER TABLE "StripeWebhookEvent" ADD COLUMN "eventCreatedAt" TIMESTAMP(3);
