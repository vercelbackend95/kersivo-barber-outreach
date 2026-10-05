-- CreateEnum
CREATE TYPE "ShopDepartureStatus" AS ENUM ('WINDING_DOWN', 'RETENTION');

-- CreateEnum
CREATE TYPE "ShopDepartureOrigin" AS ENUM ('DIRECT_STARTER_LEAVE', 'FULL_POST_PERIOD_LEAVE', 'NO_POST_FULL_CHOICE');

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'SHOP_DEPARTURE_CONFIRMATION';

-- CreateTable
CREATE TABLE "ShopDeparture" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "ShopDepartureStatus" NOT NULL,
    "origin" "ShopDepartureOrigin" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "requestedByUserId" TEXT,
    "requestedByEmail" TEXT,
    "saasSubscriptionId" TEXT,
    "serviceEndedAt" TIMESTAMP(3) NOT NULL,
    "windDownStartedAt" TIMESTAMP(3),
    "retentionStartedAt" TIMESTAMP(3),
    "retentionEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopDeparture_shopId_key" ON "ShopDeparture"("shopId");

-- CreateIndex
CREATE INDEX "ShopDeparture_status_retentionEndsAt_idx" ON "ShopDeparture"("status", "retentionEndsAt");

-- AddForeignKey
ALTER TABLE "ShopDeparture" ADD CONSTRAINT "ShopDeparture_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

