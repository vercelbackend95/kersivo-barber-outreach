-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'BOOKING_CONFIRMATION';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'BOOKING_RESCHEDULED';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'SHOP_ORDER_CONFIRMATION';

-- AlterTable Booking: client idempotency key for create retries
ALTER TABLE "Booking" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- AlterTable EmailOutbound: durable retry / replay fields
ALTER TABLE "EmailOutbound" ADD COLUMN "payload" JSONB;
ALTER TABLE "EmailOutbound" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailOutbound" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "EmailOutbound" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "EmailOutbound" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "EmailOutbound" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "EmailOutbound" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "EmailOutbound_status_nextAttemptAt_idx" ON "EmailOutbound"("status", "nextAttemptAt");
