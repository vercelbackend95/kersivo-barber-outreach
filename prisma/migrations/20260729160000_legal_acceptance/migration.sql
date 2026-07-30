-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "shopId" TEXT,
    "stripeSessionId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalAcceptance_email_createdAt_idx" ON "LegalAcceptance"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_stripeSessionId_idx" ON "LegalAcceptance"("stripeSessionId");

-- CreateIndex
CREATE INDEX "LegalAcceptance_purpose_createdAt_idx" ON "LegalAcceptance"("purpose", "createdAt");
