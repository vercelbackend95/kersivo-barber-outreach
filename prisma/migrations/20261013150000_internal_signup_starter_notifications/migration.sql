-- Internal KERSIVO notifications for new user registrations and first Starter activations.
-- Additive only: existing rows and existing code paths are unaffected.

-- AlterEnum
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'USER_REGISTRATION_INTERNAL';
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'STARTER_ACTIVATION_INTERNAL';

-- AlterEnum
ALTER TYPE "EmailOutboundStatus" ADD VALUE 'SUPPRESSED';

-- AlterTable: a new user may not have a shop yet (e.g. invited team members).
ALTER TABLE "EmailOutbound" ALTER COLUMN "shopId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InternalNotificationRollout" (
    "key" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNotificationRollout_pkey" PRIMARY KEY ("key")
);

-- CreateTable: Production-only origin markers (Production and Preview share one database).
CREATE TABLE "InternalNotificationOrigin" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNotificationOrigin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalNotificationOrigin_kind_subjectKey_key" ON "InternalNotificationOrigin"("kind", "subjectKey");

-- CreateIndex
CREATE INDEX "InternalNotificationOrigin_kind_createdAt_idx" ON "InternalNotificationOrigin"("kind", "createdAt");

-- Rollout cutoff = the moment this migration is applied. Reconciliation never backfills
-- registrations or Starter activations from before this point.
INSERT INTO "InternalNotificationRollout" ("key", "enabledAt")
VALUES ('INTERNAL_SIGNUP_STARTER_NOTIFICATIONS', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
