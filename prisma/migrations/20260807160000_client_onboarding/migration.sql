-- CreateEnum
CREATE TYPE "ClientOnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'READY_FOR_BUILD');

-- CreateEnum
CREATE TYPE "ClientOnboardingDomainMode" AS ENUM ('EXISTING', 'KERSIVO_REGISTER', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "ClientOnboardingAssetKind" AS ENUM ('BRAND_LOGO', 'GALLERY_IMAGE', 'BRAND_GUIDELINES', 'MIGRATION_CSV', 'OTHER');

-- CreateTable
CREATE TABLE "ClientOnboarding" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "ClientOnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legalBusinessName" TEXT,
    "businessType" TEXT,
    "companyNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "townCity" TEXT,
    "postcode" TEXT,
    "publicEmail" TEXT,
    "publicPhone" TEXT,
    "primaryContactName" TEXT,
    "primaryContactEmail" TEXT,
    "tagline" TEXT,
    "shopDescription" TEXT,
    "websiteNotes" TEXT,
    "currentWebsiteUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "otherSocialUrl" TEXT,
    "brandNotes" TEXT,
    "preferredPrimaryColour" TEXT,
    "preferredSecondaryColour" TEXT,
    "domainMode" "ClientOnboardingDomainMode" NOT NULL DEFAULT 'UNDECIDED',
    "existingDomain" TEXT,
    "domainRegistrar" TEXT,
    "preferredDomain1" TEXT,
    "preferredDomain2" TEXT,
    "preferredDomain3" TEXT,
    "domainRegistrationAuthorised" BOOLEAN NOT NULL DEFAULT false,
    "domainRegistrationAuthorisedAt" TIMESTAMP(3),
    "migrationRequested" BOOLEAN NOT NULL DEFAULT false,
    "migrationSource" TEXT,
    "migrationSourceOther" TEXT,
    "migrationNotes" TEXT,
    "migrationDataConfirmedLawful" BOOLEAN NOT NULL DEFAULT false,
    "migrationDataConfirmedAt" TIMESTAMP(3),
    "launchRetail" BOOLEAN,
    "launchDeposits" BOOLEAN,
    "retailProductsDeferred" BOOLEAN NOT NULL DEFAULT false,
    "notificationReplyToEmail" TEXT,
    "additionalNotes" TEXT,
    "portfolioConsent" BOOLEAN NOT NULL DEFAULT false,
    "socialMediaConsent" BOOLEAN NOT NULL DEFAULT false,
    "advertisingConsent" BOOLEAN NOT NULL DEFAULT false,
    "caseStudyConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentUpdatedAt" TIMESTAMP(3),
    "contentRightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "informationAccuracyConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "declarationsConfirmedAt" TIMESTAMP(3),

    CONSTRAINT "ClientOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOnboardingBarberProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "bio" TEXT,
    "showOnWebsite" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientOnboardingBarberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOnboardingAsset" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "kind" "ClientOnboardingAssetKind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientOnboardingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientOnboarding_shopId_key" ON "ClientOnboarding"("shopId");

-- CreateIndex
CREATE INDEX "ClientOnboarding_status_submittedAt_idx" ON "ClientOnboarding"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOnboardingBarberProfile_barberId_key" ON "ClientOnboardingBarberProfile"("barberId");

-- CreateIndex
CREATE INDEX "ClientOnboardingBarberProfile_shopId_idx" ON "ClientOnboardingBarberProfile"("shopId");

-- CreateIndex
CREATE INDEX "ClientOnboardingBarberProfile_onboardingId_idx" ON "ClientOnboardingBarberProfile"("onboardingId");

-- CreateIndex
CREATE INDEX "ClientOnboardingAsset_shopId_kind_idx" ON "ClientOnboardingAsset"("shopId", "kind");

-- CreateIndex
CREATE INDEX "ClientOnboardingAsset_onboardingId_idx" ON "ClientOnboardingAsset"("onboardingId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientOnboardingAsset_onboardingId_storagePath_key" ON "ClientOnboardingAsset"("onboardingId", "storagePath");

-- AddForeignKey
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboardingBarberProfile" ADD CONSTRAINT "ClientOnboardingBarberProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboardingBarberProfile" ADD CONSTRAINT "ClientOnboardingBarberProfile_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboardingBarberProfile" ADD CONSTRAINT "ClientOnboardingBarberProfile_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboardingAsset" ADD CONSTRAINT "ClientOnboardingAsset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOnboardingAsset" ADD CONSTRAINT "ClientOnboardingAsset_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
