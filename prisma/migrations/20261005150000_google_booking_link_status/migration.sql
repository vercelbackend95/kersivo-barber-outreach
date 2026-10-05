-- AlterTable
ALTER TABLE "ShopSettings"
ADD COLUMN "googleBookingLinkConfirmedAt" TIMESTAMP(3),
ADD COLUMN "googleBookingLinkConfirmedUrl" TEXT;
