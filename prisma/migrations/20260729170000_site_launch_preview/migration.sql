-- H05 cz.2: site preview + Approve & launch fields on ShopSettings + SiteLaunchEvent audit table.

ALTER TABLE "ShopSettings" ADD COLUMN "sitePreviewUrl" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "sitePreviewVersion" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "sitePreviewReadyAt" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN "launchApprovedAt" TIMESTAMP(3);
ALTER TABLE "ShopSettings" ADD COLUMN "launchApprovedByUserId" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "launchApprovedByEmail" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "launchApprovedVersion" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "goLiveAt" TIMESTAMP(3);

CREATE TABLE "SiteLaunchEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "siteVersion" TEXT,
    "previewUrl" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteLaunchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteLaunchEvent_shopId_createdAt_idx" ON "SiteLaunchEvent"("shopId", "createdAt");
CREATE INDEX "SiteLaunchEvent_action_createdAt_idx" ON "SiteLaunchEvent"("action", "createdAt");
