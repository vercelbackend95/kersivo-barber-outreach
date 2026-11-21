-- Retail pay at collection: per-shop payment mode + unpaid reservation status. Additive only;
-- existing shops keep FULL_UPFRONT (Stripe Checkout before the order is confirmed).

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'RESERVED_UNPAID';

-- CreateEnum
CREATE TYPE "RetailPaymentMode" AS ENUM ('FULL_UPFRONT', 'PAY_AT_COLLECTION');

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "retailPaymentMode" "RetailPaymentMode" NOT NULL DEFAULT 'FULL_UPFRONT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerPhone" TEXT;
