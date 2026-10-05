-- CreateEnum
CREATE TYPE "BookingPaymentMode" AS ENUM ('NONE', 'DEPOSIT', 'FULL');

-- CreateEnum
CREATE TYPE "BookingPaymentType" AS ENUM ('NONE', 'DEPOSIT', 'FULL');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "bookingPaymentMode" "BookingPaymentMode" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookingPaymentType" "BookingPaymentType",
ADD COLUMN     "kersivoPlatformFeeBps" INTEGER,
ADD COLUMN     "kersivoPlatformFeePence" INTEGER,
ADD COLUMN     "paymentAmountPence" INTEGER,
ADD COLUMN     "refundedAmountPence" INTEGER NOT NULL DEFAULT 0;

-- Backfill: legacy deposit toggle → payment mode. Never sets FULL.
UPDATE "ShopSettings"
SET "bookingPaymentMode" = 'DEPOSIT'
WHERE "depositsEnabled" = true;

-- Backfill: existing deposit bookings. All historical KERSIVO deposits used a 0% application fee.
UPDATE "Booking"
SET "bookingPaymentType" = 'DEPOSIT',
    "paymentAmountPence" = "depositAmountPence",
    "kersivoPlatformFeePence" = 0,
    "kersivoPlatformFeeBps" = 0
WHERE "paymentRequired" = true
  AND "depositAmountPence" IS NOT NULL;

-- Backfill: confirmed full deposit refunds from the durable ledger (one row per booking).
UPDATE "Booking" AS b
SET "refundedAmountPence" = r."amountPence"
FROM "BookingDepositRefund" AS r
WHERE r."bookingId" = b."id"
  AND r."status" = 'REFUNDED'
  AND b."paymentStatus" = 'REFUNDED';
