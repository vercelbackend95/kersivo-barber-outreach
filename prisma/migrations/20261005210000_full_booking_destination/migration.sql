-- CreateEnum
CREATE TYPE "FullBookingDestinationStatus" AS ENUM ('VERIFIED_LIVE', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "FullBookingDestinationEventAction" AS ENUM ('VERIFIED', 'URL_CHANGED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "FullBookingDestination" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "FullBookingDestinationStatus" NOT NULL,
    "url" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "verifiedByEmail" TEXT,
    "siteVersion" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FullBookingDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FullBookingDestinationEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "action" "FullBookingDestinationEventAction" NOT NULL,
    "url" TEXT,
    "previousUrl" TEXT,
    "siteVersion" TEXT,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FullBookingDestinationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FullBookingDestination_shopId_key" ON "FullBookingDestination"("shopId");

-- CreateIndex
CREATE INDEX "FullBookingDestinationEvent_shopId_createdAt_idx" ON "FullBookingDestinationEvent"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "FullBookingDestination" ADD CONSTRAINT "FullBookingDestination_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FullBookingDestinationEvent" ADD CONSTRAINT "FullBookingDestinationEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
