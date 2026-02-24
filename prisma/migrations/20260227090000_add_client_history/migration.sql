-- CreateTable
CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "fullName" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_shopId_email_key" ON "Client"("shopId", "email");
CREATE INDEX "Client_shopId_idx" ON "Client"("shopId");
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
