-- Additive legal-safety marker for Full -> Starter.
-- The authoritative acceptance proof remains in LegalAcceptance; this field lets entitlement
-- fail closed when a previously selected Starter continuation was accepted under an older Terms version.
ALTER TABLE "SaasSubscription"
ADD COLUMN "postFullTermsVersion" TEXT;

-- Preserve shops whose Full -> Starter continuation was already effective before this release.
-- This sentinel records legacy service state only; it does NOT claim acceptance of the v1.19 Terms.
UPDATE "SaasSubscription"
SET "postFullTermsVersion" = 'LEGACY_EFFECTIVE_PRE_V119'
WHERE "status" = 'CANCELED'
  AND "postFullPlan" = 'STARTER'
  AND "postFullTermsVersion" IS NULL;
