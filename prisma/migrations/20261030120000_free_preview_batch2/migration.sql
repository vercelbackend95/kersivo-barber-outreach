-- Free website preview, Batch 2 (docs/free-preview-spec.md §6, §7, §9 E3/E4). Additive only.

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_READY';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_UPDATED';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'FREE_PREVIEW_CHANGES_REQUESTED_INTERNAL';

-- Lookup key for the private preview URL: SHA-256 (hex) of publicToken. The page looks the request up by
-- this hash and then compares the plaintext token in constant time, so the database index never sees
-- attacker-chosen token prefixes.
ALTER TABLE "PreviewRequest" ADD COLUMN "publicTokenHash" TEXT;
UPDATE "PreviewRequest" SET "publicTokenHash" = encode(sha256(convert_to("publicToken", 'UTF8')), 'hex');
ALTER TABLE "PreviewRequest" ALTER COLUMN "publicTokenHash" SET NOT NULL;
CREATE UNIQUE INDEX "PreviewRequest_publicTokenHash_key" ON "PreviewRequest"("publicTokenHash");
