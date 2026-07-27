-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "publicActivityPauseFrom" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN "publicActivityPauseUntil" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN "publicActivityPauseReason" TEXT;
