-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "originalStartAt" TIMESTAMP(3),
ADD COLUMN "originalEndAt" TIMESTAMP(3),
ADD COLUMN "rescheduledAt" TIMESTAMP(3);
