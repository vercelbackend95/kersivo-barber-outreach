-- Free website preview, Batch 4 (docs/free-preview-spec.md section 9 E5/E6, retention). Additive only.

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_FOLLOWUP';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_EXPIRY_REMINDER';

-- AlterTable
ALTER TABLE "PreviewRequest" ADD COLUMN "anonymisedAt" TIMESTAMP(3);
