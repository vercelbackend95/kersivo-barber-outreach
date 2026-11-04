-- Shop health (docs/ops/shop-health.md): per-shop health runs and the denormalised latest light.

-- CreateEnum
CREATE TYPE "ShopHealthTrigger" AS ENUM ('CRON', 'MANUAL', 'LAUNCH');

-- CreateEnum
CREATE TYPE "ShopHealthMode" AS ENUM ('LIVE', 'PRELAUNCH');

-- CreateEnum
CREATE TYPE "ShopHealthOverall" AS ENUM ('GREEN', 'AMBER', 'RED', 'GREY');

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "healthOverall" "ShopHealthOverall",
ADD COLUMN "healthCheckedAt" TIMESTAMP(3),
ADD COLUMN "healthAlertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ShopHealthRun" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "trigger" "ShopHealthTrigger" NOT NULL,
    "mode" "ShopHealthMode" NOT NULL,
    "overall" "ShopHealthOverall" NOT NULL,
    "results" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "ShopHealthRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopHealthRun_shopId_startedAt_idx" ON "ShopHealthRun"("shopId", "startedAt");

-- AddForeignKey
ALTER TABLE "ShopHealthRun" ADD CONSTRAINT "ShopHealthRun_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
