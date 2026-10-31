-- Shop Hub Batch 1 (docs/preview-hub/HUB_SPEC.md §7). Additive only.

-- CreateEnum
CREATE TYPE "PreviewHubActor" AS ENUM ('OWNER', 'KERSIVO');

-- AlterTable
ALTER TABLE "PreviewRequest" ADD COLUMN "aboutText" TEXT,
ADD COLUMN "brandPrimaryColour" TEXT,
ADD COLUMN "brandSecondaryColour" TEXT,
ADD COLUMN "changeRoundsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "includedChangeRounds" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "launchApprovedAt" TIMESTAMP(3),
ADD COLUMN "liveAt" TIMESTAMP(3),
ADD COLUMN "opsFilesNotifiedAt" TIMESTAMP(3),
ADD COLUMN "opsLastSeenAt" TIMESTAMP(3),
ADD COLUMN "opsMessagesNotifiedAt" TIMESTAMP(3),
ADD COLUMN "ourStepDomainAt" TIMESTAMP(3),
ADD COLUMN "ourStepSslAt" TIMESTAMP(3),
ADD COLUMN "ownerLastSeenAt" TIMESTAMP(3),
ADD COLUMN "styleNotes" TEXT;
