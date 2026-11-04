-- Site data contract (docs/site-data-contract.md). Additive only: new nullable/defaulted columns
-- and two new tables. No existing column is renamed or dropped. Existing data is copied into the
-- canonical places by scripts/site-data/backfill-canonical.ts (idempotent, --dry-run by default).

-- AlterTable
ALTER TABLE "Barber" ADD COLUMN "title" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "showOnWebsite" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "priceFrom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ShopPublicProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "otherSocialUrl" TEXT,
    "brandPrimaryColour" TEXT,
    "brandSecondaryColour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOpeningException" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT true,
    "startMinutes" INTEGER,
    "endMinutes" INTEGER,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOpeningException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopPublicProfile_shopId_key" ON "ShopPublicProfile"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOpeningException_shopId_date_key" ON "ShopOpeningException"("shopId", "date");

-- AddForeignKey
ALTER TABLE "ShopPublicProfile" ADD CONSTRAINT "ShopPublicProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOpeningException" ADD CONSTRAINT "ShopOpeningException_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
