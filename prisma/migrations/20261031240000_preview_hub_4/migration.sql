-- Shop Hub Batch 4 (docs/preview-hub/HUB_SPEC.md §7). Additive only. No backfill.

-- CreateEnum
CREATE TYPE "PreviewChangeStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'DONE', 'NOT_POSSIBLE');

-- CreateEnum
CREATE TYPE "PreviewContentSection" AS ENUM ('SERVICES', 'TEAM', 'HOURS');

-- CreateEnum
CREATE TYPE "PreviewContentReviewState" AS ENUM ('CONFIRMED', 'CORRECTIONS_SENT', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "PreviewChangeRequest" (
    "id" TEXT NOT NULL,
    "previewRequestId" TEXT NOT NULL,
    "round" INTEGER,
    "page" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentId" TEXT,
    "anchor" JSONB,
    "status" "PreviewChangeStatus" NOT NULL DEFAULT 'DRAFT',
    "opsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PreviewChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviewContentReview" (
    "id" TEXT NOT NULL,
    "previewRequestId" TEXT NOT NULL,
    "section" "PreviewContentSection" NOT NULL,
    "state" "PreviewContentReviewState" NOT NULL,
    "proposal" JSONB,
    "opsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedBy" TEXT,

    CONSTRAINT "PreviewContentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewChangeRequest_previewRequestId_status_idx" ON "PreviewChangeRequest"("previewRequestId", "status");

-- CreateIndex
CREATE INDEX "PreviewContentReview_previewRequestId_section_createdAt_idx" ON "PreviewContentReview"("previewRequestId", "section", "createdAt");

-- AddForeignKey
ALTER TABLE "PreviewChangeRequest" ADD CONSTRAINT "PreviewChangeRequest_previewRequestId_fkey" FOREIGN KEY ("previewRequestId") REFERENCES "PreviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewContentReview" ADD CONSTRAINT "PreviewContentReview_previewRequestId_fkey" FOREIGN KEY ("previewRequestId") REFERENCES "PreviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
