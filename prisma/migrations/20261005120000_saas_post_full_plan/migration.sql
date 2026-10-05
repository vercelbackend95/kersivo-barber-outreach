-- CreateEnum
CREATE TYPE "SaasPostFullPlan" AS ENUM ('UNDECIDED', 'STARTER', 'LEAVE', 'CHOICE_REQUIRED');

-- AlterTable
ALTER TABLE "SaasSubscription" ADD COLUMN     "postFullPlan" "SaasPostFullPlan" NOT NULL DEFAULT 'UNDECIDED',
ADD COLUMN     "postFullPlanChosenAt" TIMESTAMP(3);

-- Backfill: subscriptions already canceled before v1.18 ended without any in-app plan choice.
UPDATE "SaasSubscription" SET "postFullPlan" = 'CHOICE_REQUIRED' WHERE "status" = 'CANCELED';
