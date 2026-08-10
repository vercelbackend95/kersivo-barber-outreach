-- Guest shop preview sessions (cookie-bound provisional onboarding).
CREATE TABLE "ShopPreviewSession" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPreviewSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopPreviewSession_tokenHash_key" ON "ShopPreviewSession"("tokenHash");
CREATE INDEX "ShopPreviewSession_shopId_idx" ON "ShopPreviewSession"("shopId");
CREATE INDEX "ShopPreviewSession_expiresAt_idx" ON "ShopPreviewSession"("expiresAt");

ALTER TABLE "ShopPreviewSession" ADD CONSTRAINT "ShopPreviewSession_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
