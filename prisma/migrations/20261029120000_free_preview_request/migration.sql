-- Free website preview requests (docs/free-preview-spec.md §4). Additive only.
-- CreateEnum
CREATE TYPE "PreviewRequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'READY', 'CHANGES_REQUESTED', 'CONVERTED', 'DECLINED', 'EXPIRED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_REQUEST_ACKNOWLEDGEMENT';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_REQUEST_INTERNAL';

-- CreateTable
CREATE TABLE "PreviewRequest" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" "PreviewRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "firstName" TEXT,
    "email" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "townCity" TEXT NOT NULL,
    "bookingPageUrl" TEXT,
    "instagramUrl" TEXT,
    "googleListingUrl" TEXT,
    "websiteUrl" TEXT,
    "barberCount" TEXT NOT NULL,
    "currentBookingSystem" TEXT NOT NULL,
    "hasOwnDomain" TEXT NOT NULL,
    "notes" TEXT,
    "authorisationConsentAt" TIMESTAMP(3) NOT NULL,
    "marketingOptInAt" TIMESTAMP(3),
    "entryPoint" TEXT,
    "draftShopId" TEXT,
    "previewReadyAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "changesRequestedText" TEXT,
    "changesRequestedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "declinedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "followupSentAt" TIMESTAMP(3),
    "expiryReminderSentAt" TIMESTAMP(3),
    "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "emailOptOutAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviewRequestEvent" (
    "id" TEXT NOT NULL,
    "previewRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "PreviewRequestStatus",
    "toStatus" "PreviewRequestStatus",
    "actorEmail" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreviewRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreviewRequest_publicToken_key" ON "PreviewRequest"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "PreviewRequest_draftShopId_key" ON "PreviewRequest"("draftShopId");

-- CreateIndex
CREATE INDEX "PreviewRequest_status_createdAt_idx" ON "PreviewRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PreviewRequest_email_idx" ON "PreviewRequest"("email");

-- CreateIndex
CREATE INDEX "PreviewRequest_expiresAt_idx" ON "PreviewRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "PreviewRequestEvent_previewRequestId_createdAt_idx" ON "PreviewRequestEvent"("previewRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "PreviewRequest" ADD CONSTRAINT "PreviewRequest_draftShopId_fkey" FOREIGN KEY ("draftShopId") REFERENCES "ShopSettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewRequestEvent" ADD CONSTRAINT "PreviewRequestEvent_previewRequestId_fkey" FOREIGN KEY ("previewRequestId") REFERENCES "PreviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

