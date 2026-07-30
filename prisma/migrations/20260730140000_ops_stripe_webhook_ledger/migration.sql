-- M02: Stripe webhook event ledger + ops alert dedupe
CREATE TYPE "StripeWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "status" "StripeWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "httpStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StripeWebhookEvent_status_createdAt_idx" ON "StripeWebhookEvent"("status", "createdAt");
CREATE INDEX "StripeWebhookEvent_type_createdAt_idx" ON "StripeWebhookEvent"("type", "createdAt");

CREATE TABLE "OpsAlertDedupe" (
    "dedupeKey" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsAlertDedupe_pkey" PRIMARY KEY ("dedupeKey")
);
