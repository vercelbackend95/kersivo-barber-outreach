-- Free website preview two-step form. Backwards compatible: existing rows and the previous code keep working.

-- AlterTable
ALTER TABLE "PreviewRequest" ALTER COLUMN "barberCount" DROP NOT NULL,
ALTER COLUMN "currentBookingSystem" DROP NOT NULL,
ALTER COLUMN "hasOwnDomain" DROP NOT NULL,
ADD COLUMN     "authorisationStatementVersion" TEXT,
ADD COLUMN     "detailsTokenHash" TEXT,
ADD COLUMN     "detailsTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "PreviewRequest_detailsTokenHash_key" ON "PreviewRequest"("detailsTokenHash");
