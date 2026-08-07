-- AlterTable: migrationRequested becomes nullable tri-state (null = unanswered).
-- Existing false rows remain explicit "No". Do not rewrite prior migration.

ALTER TABLE "ClientOnboarding" ALTER COLUMN "migrationRequested" DROP DEFAULT;
ALTER TABLE "ClientOnboarding" ALTER COLUMN "migrationRequested" DROP NOT NULL;
