-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "barberId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientNote_clientId_createdAt_idx" ON "ClientNote"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate legacy Client.notes into ClientNote rows
INSERT INTO "ClientNote" ("id", "clientId", "barberId", "body", "createdAt")
SELECT
    'migrated_' || "id",
    "id",
    NULL,
    "notes",
    "updatedAt"
FROM "Client"
WHERE "notes" IS NOT NULL AND TRIM("notes") <> '';
