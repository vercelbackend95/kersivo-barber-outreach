-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "publicActivityPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN "publicActivityPausedAt" TIMESTAMP(3);
