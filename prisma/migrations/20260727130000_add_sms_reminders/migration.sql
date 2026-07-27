-- CreateEnum
CREATE TYPE "SmsOutboundPurpose" AS ENUM ('APPOINTMENT_REMINDER');

-- CreateEnum
CREATE TYPE "SmsOutboundStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "smsReminderSentAt" TIMESTAMP(3),
ADD COLUMN "smsReminderForStartAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_status_startAt_idx" ON "Booking"("status", "startAt");

-- CreateTable
CREATE TABLE "SmsOutbound" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "bookingId" TEXT,
    "toE164" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "purpose" "SmsOutboundPurpose" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "SmsOutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOutbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsOutbound_bookingId_idx" ON "SmsOutbound"("bookingId");

-- CreateIndex
CREATE INDEX "SmsOutbound_shopId_createdAt_idx" ON "SmsOutbound"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsOutbound" ADD CONSTRAINT "SmsOutbound_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
