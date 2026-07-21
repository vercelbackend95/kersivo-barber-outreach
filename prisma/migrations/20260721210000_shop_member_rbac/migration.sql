-- WP-E Phase 1: ShopMember RBAC (per shopId)
CREATE TYPE "ShopRole" AS ENUM ('OWNER', 'MANAGER', 'BARBER');

ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Barber_userId_key" ON "Barber"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Barber_userId_fkey'
  ) THEN
    ALTER TABLE "Barber"
      ADD CONSTRAINT "Barber_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ShopMember" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ShopRole" NOT NULL,
    "barberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopMember_shopId_userId_key" ON "ShopMember"("shopId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopMember_barberId_key" ON "ShopMember"("barberId");
CREATE INDEX IF NOT EXISTS "ShopMember_userId_idx" ON "ShopMember"("userId");
CREATE INDEX IF NOT EXISTS "ShopMember_shopId_role_idx" ON "ShopMember"("shopId", "role");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopMember_shopId_fkey'
  ) THEN
    ALTER TABLE "ShopMember"
      ADD CONSTRAINT "ShopMember_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopMember_userId_fkey'
  ) THEN
    ALTER TABLE "ShopMember"
      ADD CONSTRAINT "ShopMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopMember_barberId_fkey'
  ) THEN
    ALTER TABLE "ShopMember"
      ADD CONSTRAINT "ShopMember_barberId_fkey"
      FOREIGN KEY ("barberId") REFERENCES "Barber"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: every shop owner becomes ShopMember OWNER for that shopId
INSERT INTO "ShopMember" ("id", "shopId", "userId", "role", "createdAt", "updatedAt")
SELECT
  'sm_' || md5(s."id" || ':' || s."ownerUserId"),
  s."id",
  s."ownerUserId",
  'OWNER'::"ShopRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ShopSettings" s
WHERE s."ownerUserId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ShopMember" m
    WHERE m."shopId" = s."id" AND m."userId" = s."ownerUserId"
  );
