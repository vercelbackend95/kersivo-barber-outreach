-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT' BEFORE 'PAID';

-- AlterTable ShopSettings
ALTER TABLE "ShopSettings" ADD COLUMN "retailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "reference" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripeConnectAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");
