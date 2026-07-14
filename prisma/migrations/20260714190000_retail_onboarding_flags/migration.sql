-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "retailOnboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "retailOnboardingSkipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "retailOnboardingCompletedAt" TIMESTAMP(3);

-- Backfill: shops that already have products have completed retail onboarding
UPDATE "ShopSettings" AS s
SET
  "retailOnboardingCompleted" = true,
  "retailOnboardingCompletedAt" = COALESCE(s."retailOnboardingCompletedAt", NOW())
WHERE EXISTS (
  SELECT 1 FROM "Product" p WHERE p."shopId" = s."id"
)
AND s."retailOnboardingCompleted" = false;
