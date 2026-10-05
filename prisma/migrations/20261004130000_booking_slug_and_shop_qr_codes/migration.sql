-- CreateEnum
CREATE TYPE "ShopQrPlacement" AS ENUM ('WINDOW', 'REBOOK');

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "bookingSlug" TEXT;

-- CreateTable
CREATE TABLE "ShopQrCode" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "placement" "ShopQrPlacement" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopQrCode_code_key" ON "ShopQrCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShopQrCode_shopId_placement_key" ON "ShopQrCode"("shopId", "placement");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_bookingSlug_key" ON "ShopSettings"("bookingSlug");

-- AddForeignKey
ALTER TABLE "ShopQrCode" ADD CONSTRAINT "ShopQrCode_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
