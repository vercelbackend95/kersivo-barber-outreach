-- Smart Retail operator control plane: rail pause control + immutable ops action audit.

CREATE TABLE "ShopRecommendationControl" (
    "shopId" TEXT NOT NULL,
    "railPaused" BOOLEAN NOT NULL DEFAULT false,
    "railPausedAt" TIMESTAMP(3),
    "railPausedByUserId" TEXT,
    "railPauseReason" TEXT,
    "lastBuildActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopRecommendationControl_pkey" PRIMARY KEY ("shopId")
);

CREATE TABLE "RecommendationOpsAction" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "shopId" TEXT,
    "shopIdSnapshot" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "errorCode" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationOpsAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationOpsAction_idempotencyKey_key" ON "RecommendationOpsAction"("idempotencyKey");

CREATE INDEX "RecommendationOpsAction_shopId_createdAt_idx" ON "RecommendationOpsAction"("shopId", "createdAt");

CREATE INDEX "RecommendationOpsAction_actorUserId_createdAt_idx" ON "RecommendationOpsAction"("actorUserId", "createdAt");

CREATE INDEX "RecommendationOpsAction_action_createdAt_idx" ON "RecommendationOpsAction"("action", "createdAt");

ALTER TABLE "ShopRecommendationControl" ADD CONSTRAINT "ShopRecommendationControl_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecommendationOpsAction" ADD CONSTRAINT "RecommendationOpsAction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
