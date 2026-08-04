-- AlterTable: checkoutAttemptId for SaaS checkout reuse / Idempotency-Key
ALTER TABLE "SaasSubscription" ADD COLUMN "checkoutAttemptId" TEXT;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "SaasSubscription_checkoutAttemptId_key" ON "SaasSubscription"("checkoutAttemptId");

-- Drop non-unique index on stripeSubscriptionId, then enforce uniqueness
DROP INDEX IF EXISTS "SaasSubscription_stripeSubscriptionId_idx";

-- Fail if duplicate non-null stripeSubscriptionId values already exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SaasSubscription"
    WHERE "stripeSubscriptionId" IS NOT NULL
    GROUP BY "stripeSubscriptionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique stripeSubscriptionId: duplicate Stripe subscriptions exist across SaasSubscription rows';
  END IF;
END $$;

CREATE UNIQUE INDEX "SaasSubscription_stripeSubscriptionId_key" ON "SaasSubscription"("stripeSubscriptionId");

-- PENDING cleanup only: remove PENDING when shop already has a paid/open entitlement
DELETE FROM "SaasSubscription" AS pending
WHERE pending."status" = 'PENDING'
  AND pending."shopId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "SaasSubscription" AS paid
    WHERE paid."shopId" = pending."shopId"
      AND paid."status" IN ('ACTIVE', 'PAST_DUE', 'SUSPENDED')
  );

-- PENDING cleanup only: keep newest PENDING per shopId, delete older duplicates
DELETE FROM "SaasSubscription" AS older
WHERE older."status" = 'PENDING'
  AND older."shopId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "SaasSubscription" AS newer
    WHERE newer."shopId" = older."shopId"
      AND newer."status" = 'PENDING'
      AND (
        newer."createdAt" > older."createdAt"
        OR (newer."createdAt" = older."createdAt" AND newer."id" > older."id")
      )
  );

-- Fail loudly if two+ paid/active open rows remain for one shop
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SaasSubscription"
    WHERE "shopId" IS NOT NULL
      AND "status" IN ('ACTIVE', 'PAST_DUE', 'SUSPENDED')
    GROUP BY "shopId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create SaasSubscription_one_open_per_shop_idx: shop has multiple ACTIVE/PAST_DUE/SUSPENDED rows';
  END IF;
END $$;

-- Partial unique: at most one open subscription row per shop
CREATE UNIQUE INDEX "SaasSubscription_one_open_per_shop_idx"
ON "SaasSubscription" ("shopId")
WHERE "shopId" IS NOT NULL
AND "status" IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
