-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable ShopSettings
ALTER TABLE "ShopSettings" ALTER COLUMN "cancellationWindowHours" SET DEFAULT 24;
ALTER TABLE "ShopSettings" ALTER COLUMN "rescheduleWindowHours" SET DEFAULT 24;
ALTER TABLE "ShopSettings" ADD COLUMN "maxClientReschedules" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ShopSettings" ADD COLUMN "shopPaidAt" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN "depositsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN "stripeConnectDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ShopSettings"
SET "cancellationWindowHours" = 24
WHERE "cancellationWindowHours" = 2;

UPDATE "ShopSettings"
SET "rescheduleWindowHours" = 24
WHERE "rescheduleWindowHours" = 2;

UPDATE "ShopSettings"
SET "shopPaidAt" = COALESCE("shopPaidAt", NOW())
WHERE "smsRemindersEnabled" = true AND "shopPaidAt" IS NULL;

-- AlterTable Booking
ALTER TABLE "Booking" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "depositRefundedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "depositForfeitedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "clientRescheduleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

CREATE INDEX "Booking_status_paymentExpiresAt_idx" ON "Booking"("status", "paymentExpiresAt");
