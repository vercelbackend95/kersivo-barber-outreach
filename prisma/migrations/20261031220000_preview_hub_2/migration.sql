-- Shop Hub Batch 2 (docs/preview-hub/HUB_SPEC.md §7). Additive only.

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_FILES_INTERNAL';

-- CreateEnum
CREATE TYPE "PreviewHubAssetKind" AS ENUM (
  'LOGO',
  'SHOP_PHOTO',
  'TEAM_PHOTO',
  'PRICE_LIST',
  'MESSAGE_ATTACHMENT',
  'CHANGE_ATTACHMENT',
  'OTHER'
);

-- CreateTable
CREATE TABLE "PreviewHubAsset" (
    "id" TEXT NOT NULL,
    "previewRequestId" TEXT NOT NULL,
    "kind" "PreviewHubAssetKind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "thumbPath" TEXT,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "barberId" TEXT,
    "uploadedBy" "PreviewHubActor" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PreviewHubAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewHubAsset_previewRequestId_kind_idx" ON "PreviewHubAsset"("previewRequestId", "kind");

-- AddForeignKey
ALTER TABLE "PreviewHubAsset" ADD CONSTRAINT "PreviewHubAsset_previewRequestId_fkey" FOREIGN KEY ("previewRequestId") REFERENCES "PreviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
