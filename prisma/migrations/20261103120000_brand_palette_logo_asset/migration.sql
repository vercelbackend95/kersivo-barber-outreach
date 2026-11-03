-- Hub O5: remember which logo the saved palette was extracted from, so the Colours app
-- shows the saved palette instantly and only re-extracts after a new logo. Additive, nullable.

-- AlterTable
ALTER TABLE "PreviewRequest" ADD COLUMN "brandPaletteLogoAssetId" TEXT;
