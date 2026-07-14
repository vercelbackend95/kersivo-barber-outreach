-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "townCity" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "onboardingCurrentStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- Grandfather all existing shops so active customers are not forced through onboarding.
UPDATE "ShopSettings"
SET
  "onboardingCompleted" = true,
  "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", NOW())
WHERE "onboardingCompleted" = false;
