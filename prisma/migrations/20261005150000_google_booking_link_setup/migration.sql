-- CreateEnum
CREATE TYPE "GoogleBookingLinkStatus" AS ENUM ('NOT_SET', 'SETUP_STARTED', 'MERCHANT_CONFIRMED');

-- AlterTable
ALTER TABLE "ShopSettings"
ADD COLUMN "googleBookingLinkStatus" "GoogleBookingLinkStatus" NOT NULL DEFAULT 'NOT_SET',
ADD COLUMN "googleBookingConfirmedUrl" TEXT,
ADD COLUMN "googleBookingStatusUpdatedAt" TIMESTAMP(3);
