-- ShopInvite for team invites (bound to shopId)
CREATE TABLE IF NOT EXISTS "ShopInvite" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ShopRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "barberId" TEXT,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopInvite_tokenHash_key" ON "ShopInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "ShopInvite_shopId_email_idx" ON "ShopInvite"("shopId", "email");
CREATE INDEX IF NOT EXISTS "ShopInvite_expiresAt_idx" ON "ShopInvite"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopInvite_shopId_fkey'
  ) THEN
    ALTER TABLE "ShopInvite"
      ADD CONSTRAINT "ShopInvite_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
