-- Add barber sort order
ALTER TABLE "Barber"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Initialize existing rows by creation order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) - 1 AS rn
  FROM "Barber"
)
UPDATE "Barber" b
SET "sortOrder" = ordered.rn
FROM ordered
WHERE b.id = ordered.id;

CREATE INDEX "Barber_active_sortOrder_idx" ON "Barber"("active", "sortOrder");
