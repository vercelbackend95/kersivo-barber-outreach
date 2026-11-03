-- Ops health: remember when the "Transactional email stuck" Sentry alert fired for a row so it
-- alerts once instead of every ops-health run. Additive, nullable, no backfill.

-- AlterTable
ALTER TABLE "EmailOutbound" ADD COLUMN "stuckAlertedAt" TIMESTAMP(3);
