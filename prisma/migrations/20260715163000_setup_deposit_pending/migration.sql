-- AlterEnum
ALTER TYPE "SetupDepositStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "SetupDeposit" ALTER COLUMN "paidAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "SetupDeposit_customerEmail_status_idx" ON "SetupDeposit"("customerEmail", "status");
