-- CreateEnum
CREATE TYPE "RecommendationSetStatus" AS ENUM ('BUILDING', 'READY', 'SUPERSEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationJobStatus" AS ENUM ('IDLE', 'PENDING', 'PROCESSING', 'FAILED');

-- CreateTable
CREATE TABLE "ShopRecommendationState" (
    "shopId" TEXT NOT NULL,
    "catalogueVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedCatalogueVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedSetId" TEXT,
    "pendingCatalogueVersion" INTEGER,
    "rebuildAfter" TIMESTAMP(3),
    "jobStatus" "RecommendationJobStatus" NOT NULL DEFAULT 'IDLE',
    "processingCatalogueVersion" INTEGER,
    "processingLockId" TEXT,
    "processingLockExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "taxonomyVersion" TEXT NOT NULL DEFAULT '2026-09-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopRecommendationState_pkey" PRIMARY KEY ("shopId")
);

-- CreateTable
CREATE TABLE "ServiceSemanticProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "classifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSemanticProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSemanticProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "classifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSemanticProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationSet" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "catalogueVersion" INTEGER NOT NULL,
    "taxonomyVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "status" "RecommendationSetStatus" NOT NULL,
    "modelId" TEXT,
    "rerankModelId" TEXT,
    "promptVersion" TEXT NOT NULL,
    "buildStartedAt" TIMESTAMP(3) NOT NULL,
    "buildFinishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationSetItem" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "deterministicScore" DOUBLE PRECISION NOT NULL,
    "rerankPosition" INTEGER,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceGate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationSetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopRecommendationState_rebuildAfter_jobStatus_idx" ON "ShopRecommendationState"("rebuildAfter", "jobStatus");

-- CreateIndex
CREATE INDEX "ShopRecommendationState_nextAttemptAt_jobStatus_idx" ON "ShopRecommendationState"("nextAttemptAt", "jobStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSemanticProfile_serviceId_key" ON "ServiceSemanticProfile"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceSemanticProfile_shopId_idx" ON "ServiceSemanticProfile"("shopId");

-- CreateIndex
CREATE INDEX "ServiceSemanticProfile_shopId_contentHash_idx" ON "ServiceSemanticProfile"("shopId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSemanticProfile_productId_key" ON "ProductSemanticProfile"("productId");

-- CreateIndex
CREATE INDEX "ProductSemanticProfile_shopId_idx" ON "ProductSemanticProfile"("shopId");

-- CreateIndex
CREATE INDEX "ProductSemanticProfile_shopId_contentHash_idx" ON "ProductSemanticProfile"("shopId", "contentHash");

-- CreateIndex
CREATE INDEX "RecommendationSet_shopId_catalogueVersion_idx" ON "RecommendationSet"("shopId", "catalogueVersion");

-- CreateIndex
CREATE INDEX "RecommendationSet_shopId_status_idx" ON "RecommendationSet"("shopId", "status");

-- CreateIndex
CREATE INDEX "RecommendationSetItem_setId_serviceId_idx" ON "RecommendationSetItem"("setId", "serviceId");

-- CreateIndex
CREATE INDEX "RecommendationSetItem_shopId_serviceId_idx" ON "RecommendationSetItem"("shopId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationSetItem_setId_serviceId_productId_key" ON "RecommendationSetItem"("setId", "serviceId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationSetItem_setId_serviceId_rank_key" ON "RecommendationSetItem"("setId", "serviceId", "rank");

-- AddForeignKey
ALTER TABLE "ShopRecommendationState" ADD CONSTRAINT "ShopRecommendationState_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRecommendationState" ADD CONSTRAINT "ShopRecommendationState_publishedSetId_fkey" FOREIGN KEY ("publishedSetId") REFERENCES "RecommendationSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSemanticProfile" ADD CONSTRAINT "ServiceSemanticProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSemanticProfile" ADD CONSTRAINT "ServiceSemanticProfile_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSemanticProfile" ADD CONSTRAINT "ProductSemanticProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSemanticProfile" ADD CONSTRAINT "ProductSemanticProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSet" ADD CONSTRAINT "RecommendationSet_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSetItem" ADD CONSTRAINT "RecommendationSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "RecommendationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSetItem" ADD CONSTRAINT "RecommendationSetItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSetItem" ADD CONSTRAINT "RecommendationSetItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSetItem" ADD CONSTRAINT "RecommendationSetItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
