-- Preview-phase brand lock. brandColoursSentAt (added in 20261031260000) is the lock
-- timestamp: null = owner can still change logo/colours; set = submitted and locked.
-- Shops that already sent colours stay locked. Snapshot is what KERSIVO builds from.

-- AlterTable
ALTER TABLE "PreviewRequest" ADD COLUMN "brandSubmittedByUserId" TEXT,
ADD COLUMN "brandSubmittedSnapshot" JSONB;

-- Backfill the submit snapshot from the live logo (latest non-deleted) + colour columns.
UPDATE "PreviewRequest" AS pr
SET "brandSubmittedSnapshot" = jsonb_build_object(
  'logoAssetId', logo.id,
  'logoStoragePath', logo."storagePath",
  'logoOriginalFileName', logo."originalFileName",
  'logoContentType', logo."contentType",
  'brandPrimaryColour', pr."brandPrimaryColour",
  'brandSecondaryColour', pr."brandSecondaryColour",
  'brandBackgroundTone', pr."brandBackgroundTone",
  'brandColoursSource', pr."brandColoursSource",
  'brandPaletteExtracted', pr."brandPaletteExtracted",
  'submittedByUserId', NULL
)
FROM (
  SELECT
    pr2.id AS request_id,
    logo.id,
    logo."storagePath",
    logo."originalFileName",
    logo."contentType"
  FROM "PreviewRequest" pr2
  LEFT JOIN LATERAL (
    SELECT id, "storagePath", "originalFileName", "contentType"
    FROM "PreviewHubAsset"
    WHERE "previewRequestId" = pr2.id
      AND kind = 'LOGO'
      AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  ) AS logo ON true
  WHERE pr2."brandColoursSentAt" IS NOT NULL
    AND pr2."brandSubmittedSnapshot" IS NULL
) AS src
WHERE pr.id = src.request_id;

DO $$
DECLARE
  affected integer;
BEGIN
  SELECT COUNT(*) INTO affected
  FROM "PreviewRequest"
  WHERE "brandColoursSentAt" IS NOT NULL;
  RAISE NOTICE 'preview_brand_lock backfill: % preview requests already submitted (treated as locked)', affected;
END $$;
