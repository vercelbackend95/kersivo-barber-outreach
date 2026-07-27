-- CreateTable
CREATE TABLE "ShopOpeningHours" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopOpeningHours_shopId_idx" ON "ShopOpeningHours"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOpeningHours_shopId_dayOfWeek_key" ON "ShopOpeningHours"("shopId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "ShopOpeningHours" ADD CONSTRAINT "ShopOpeningHours_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
