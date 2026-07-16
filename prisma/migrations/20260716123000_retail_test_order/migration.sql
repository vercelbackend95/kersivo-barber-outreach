-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isTestOrder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable ShopSettings
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "retailTestOrderId" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "retailTestOrderCompletedAt" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "retailPickupWalkthroughCompletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_shopId_isTestOrder_idx" ON "Order"("shopId", "isTestOrder");
