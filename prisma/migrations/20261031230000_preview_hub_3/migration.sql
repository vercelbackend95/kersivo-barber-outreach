-- Shop Hub Batch 3 (docs/preview-hub/HUB_SPEC.md §7). Additive only.

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_MESSAGE_OWNER';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_HUB_MESSAGES_INTERNAL';

-- CreateTable
CREATE TABLE "PreviewHubMessage" (
    "id" TEXT NOT NULL,
    "previewRequestId" TEXT NOT NULL,
    "author" "PreviewHubActor" NOT NULL,
    "authorEmail" TEXT,
    "body" TEXT NOT NULL,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readByOwnerAt" TIMESTAMP(3),
    "readByOpsAt" TIMESTAMP(3),

    CONSTRAINT "PreviewHubMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewHubMessage_previewRequestId_createdAt_idx" ON "PreviewHubMessage"("previewRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "PreviewHubMessage" ADD CONSTRAINT "PreviewHubMessage_previewRequestId_fkey" FOREIGN KEY ("previewRequestId") REFERENCES "PreviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
