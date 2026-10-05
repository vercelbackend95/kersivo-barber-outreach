-- CreateEnum
CREATE TYPE "StripeConnectAccountType" AS ENUM ('EXPRESS', 'STANDARD');

-- AlterTable
ALTER TABLE "ShopSettings"
ADD COLUMN "stripeConnectAccountType" "StripeConnectAccountType",
ADD COLUMN "stripeConnectDisconnectedAt" TIMESTAMP(3);

-- Every existing current Connect account was created by the pre-v1.18 Express-only path.
UPDATE "ShopSettings"
SET "stripeConnectAccountType" = 'EXPRESS'
WHERE "stripeConnectAccountId" IS NOT NULL
  AND "stripeConnectAccountType" IS NULL;
