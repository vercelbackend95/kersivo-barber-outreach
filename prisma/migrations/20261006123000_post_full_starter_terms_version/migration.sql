-- Additive legal-safety marker for Full -> Starter.
-- The authoritative acceptance proof remains in LegalAcceptance; this field lets entitlement
-- fail closed when a previously selected Starter continuation was accepted under an older Terms version.
ALTER TABLE "SaasSubscription"
ADD COLUMN "postFullTermsVersion" TEXT;
