-- Forward-only: align ShopRecommendationState taxonomy default with active TAXONOMY_VERSION.
-- Does not modify semantic profiles or recommendation sets.

ALTER TABLE "ShopRecommendationState"
  ALTER COLUMN "taxonomyVersion" SET DEFAULT '2026-09-v2';

UPDATE "ShopRecommendationState"
SET "taxonomyVersion" = '2026-09-v2'
WHERE "taxonomyVersion" = '2026-09-v1';
