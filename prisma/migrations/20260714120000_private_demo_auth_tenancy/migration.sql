-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_key" ON "session"("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

ALTER TABLE "session"
  DROP CONSTRAINT IF EXISTS "session_userId_fkey",
  ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account"
  DROP CONSTRAINT IF EXISTS "account_userId_fkey",
  ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Shop ownership
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ShopSettings_ownerUserId_key" ON "ShopSettings"("ownerUserId");

ALTER TABLE "ShopSettings"
  DROP CONSTRAINT IF EXISTS "ShopSettings_ownerUserId_fkey",
  ADD CONSTRAINT "ShopSettings_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenancy: Barber.shopId / Service.shopId
ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "shopId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "shopId" TEXT;

UPDATE "Barber" SET "shopId" = 'demo-shop' WHERE "shopId" IS NULL;
UPDATE "Service" SET "shopId" = 'demo-shop' WHERE "shopId" IS NULL;

ALTER TABLE "Barber" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "shopId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Barber_shopId_active_sortOrder_idx" ON "Barber"("shopId", "active", "sortOrder");
CREATE INDEX IF NOT EXISTS "Service_shopId_active_displayOrder_idx" ON "Service"("shopId", "active", "displayOrder");

ALTER TABLE "Barber"
  DROP CONSTRAINT IF EXISTS "Barber_shopId_fkey",
  ADD CONSTRAINT "Barber_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Service"
  DROP CONSTRAINT IF EXISTS "Service_shopId_fkey",
  ADD CONSTRAINT "Service_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
