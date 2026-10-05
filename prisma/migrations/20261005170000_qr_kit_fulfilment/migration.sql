-- CreateEnum
CREATE TYPE "QrKitFulfilmentStatus" AS ENUM ('REQUESTED', 'VERIFYING', 'APPROVED', 'PRINT_QUEUED', 'DISPATCHED', 'NEEDS_REVIEW', 'REJECTED');

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'QR_KIT_REQUEST_ACKNOWLEDGEMENT';

-- CreateTable
CREATE TABLE "QrKitFulfilment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "QrKitFulfilmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedByUserId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "shopNameSnapshot" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "townCity" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'GB',
    "verifyingAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "printQueuedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "needsReviewAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "printReference" TEXT,
    "dispatchCarrier" TEXT,
    "dispatchReference" TEXT,
    "printCostPence" INTEGER,
    "packagingCostPence" INTEGER,
    "postageCostPence" INTEGER,
    "otherCostPence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrKitFulfilment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrKitFulfilmentEvent" (
    "id" TEXT NOT NULL,
    "fulfilmentId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "fromStatus" "QrKitFulfilmentStatus",
    "toStatus" "QrKitFulfilmentStatus" NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrKitFulfilmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrKitFulfilment_shopId_key" ON "QrKitFulfilment"("shopId");

-- CreateIndex
CREATE INDEX "QrKitFulfilment_status_requestedAt_idx" ON "QrKitFulfilment"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "QrKitFulfilmentEvent_fulfilmentId_createdAt_idx" ON "QrKitFulfilmentEvent"("fulfilmentId", "createdAt");

-- CreateIndex
CREATE INDEX "QrKitFulfilmentEvent_shopId_idx" ON "QrKitFulfilmentEvent"("shopId");

-- AddForeignKey
ALTER TABLE "QrKitFulfilment" ADD CONSTRAINT "QrKitFulfilment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrKitFulfilmentEvent" ADD CONSTRAINT "QrKitFulfilmentEvent_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "QrKitFulfilment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrKitFulfilmentEvent" ADD CONSTRAINT "QrKitFulfilmentEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

