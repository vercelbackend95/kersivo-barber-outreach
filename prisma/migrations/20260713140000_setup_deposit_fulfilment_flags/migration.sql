-- AlterTable
ALTER TABLE "SetupDeposit" ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT;
ALTER TABLE "SetupDeposit" ADD COLUMN IF NOT EXISTS "customerEmailSentAt" TIMESTAMP(3);
ALTER TABLE "SetupDeposit" ADD COLUMN IF NOT EXISTS "internalEmailSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SetupDeposit_paymentIntentId_idx" ON "SetupDeposit"("paymentIntentId");
