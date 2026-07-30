-- CreateTable
CREATE TABLE "AccountLifecycleEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "shopId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountLifecycleEvent_action_createdAt_idx" ON "AccountLifecycleEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AccountLifecycleEvent_userId_idx" ON "AccountLifecycleEvent"("userId");

-- CreateIndex
CREATE INDEX "AccountLifecycleEvent_shopId_idx" ON "AccountLifecycleEvent"("shopId");

-- CreateIndex
CREATE INDEX "AccountLifecycleEvent_email_idx" ON "AccountLifecycleEvent"("email");

-- CreateIndex
CREATE INDEX "SaasSubscription_status_retentionEndsAt_idx" ON "SaasSubscription"("status", "retentionEndsAt");
