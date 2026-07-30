-- CreateEnum
CREATE TYPE "EmailOutboundPurpose" AS ENUM ('APPOINTMENT_REMINDER');

-- CreateEnum
CREATE TYPE "EmailOutboundStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "emailReminderSentAt" TIMESTAMP(3),
ADD COLUMN "emailReminderForStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailOutbound" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "bookingId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "purpose" "EmailOutboundPurpose" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "EmailOutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOutbound_bookingId_idx" ON "EmailOutbound"("bookingId");

-- CreateIndex
CREATE INDEX "EmailOutbound_shopId_createdAt_idx" ON "EmailOutbound"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailOutbound" ADD CONSTRAINT "EmailOutbound_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
