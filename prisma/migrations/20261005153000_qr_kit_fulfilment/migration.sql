-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE IF NOT EXISTS 'QR_KIT_REQUESTED';

-- CreateEnum
CREATE TYPE "QrKitFulfilmentStatus" AS ENUM (
  'REQUESTED',
  'VERIFYING',
  'APPROVED',
  'PRINT_QUEUED',
  'DISPATCHED',
  'NEEDS_REVIEW',
  'REJECTED'
);

-- CreateTable
CREATE TABLE "ShopQrKitRequest" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "status" "QrKitFulfilmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "deliveryContactName" TEXT NOT NULL,
  "deliveryPhone" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "townCity" TEXT NOT NULL,
  "postcode" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'GB',
  "verificationNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "printQueuedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopQrKitRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopQrKitRequest_shopId_key" ON "ShopQrKitRequest"("shopId");
CREATE INDEX "ShopQrKitRequest_status_requestedAt_idx"
  ON "ShopQrKitRequest"("status", "requestedAt");

ALTER TABLE "ShopQrKitRequest"
ADD CONSTRAINT "ShopQrKitRequest_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
