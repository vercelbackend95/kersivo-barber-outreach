-- CreateEnum
CREATE TYPE "SetupPlan" AS ENUM ('LAUNCH', 'PRIORITY');

-- CreateEnum
CREATE TYPE "SetupDepositStatus" AS ENUM ('PAID');

-- CreateTable
CREATE TABLE "SetupDeposit" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "plan" "SetupPlan" NOT NULL,
    "status" "SetupDepositStatus" NOT NULL DEFAULT 'PAID',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopSize" TEXT NOT NULL,
    "currentStack" TEXT NOT NULL,
    "depositPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "onboardingSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SetupDeposit_stripeSessionId_key" ON "SetupDeposit"("stripeSessionId");

-- CreateIndex
CREATE INDEX "SetupDeposit_customerEmail_idx" ON "SetupDeposit"("customerEmail");

-- CreateIndex
CREATE INDEX "SetupDeposit_plan_paidAt_idx" ON "SetupDeposit"("plan", "paidAt");
