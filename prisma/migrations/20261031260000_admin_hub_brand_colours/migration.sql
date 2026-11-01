-- AlterTable
ALTER TABLE "PreviewRequest" ADD COLUMN "brandBackgroundTone" TEXT,
ADD COLUMN "brandColoursSource" TEXT,
ADD COLUMN "brandPaletteExtracted" JSONB,
ADD COLUMN "brandColoursSentAt" TIMESTAMP(3);
