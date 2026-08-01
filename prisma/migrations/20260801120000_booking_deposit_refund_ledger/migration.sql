-- CreateEnum
CREATE TYPE "DepositRefundStatus" AS ENUM ('REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED');

-- CreateTable
CREATE TABLE "BookingDepositRefund" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "DepositRefundStatus" NOT NULL DEFAULT 'REFUND_PENDING',
    "amountPence" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "stripeRefundId" TEXT,
    "stripePaymentIntentId" TEXT NOT NULL,
    "connectAccountId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingDepositRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingDepositRefund_bookingId_key" ON "BookingDepositRefund"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDepositRefund_idempotencyKey_key" ON "BookingDepositRefund"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDepositRefund_stripeRefundId_key" ON "BookingDepositRefund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "BookingDepositRefund_status_nextAttemptAt_idx" ON "BookingDepositRefund"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BookingDepositRefund_shopId_createdAt_idx" ON "BookingDepositRefund"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingDepositRefund" ADD CONSTRAINT "BookingDepositRefund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
