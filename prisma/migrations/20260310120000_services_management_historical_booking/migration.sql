ALTER TABLE "Service"
ADD COLUMN "description" TEXT,
ADD COLUMN "pricePence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "category" TEXT;

ALTER TABLE "Booking"
ADD COLUMN "serviceNameAtBooking" TEXT,
ADD COLUMN "servicePricePenceAtBooking" INTEGER,
ADD COLUMN "serviceDurationMinutesAtBooking" INTEGER,
ADD COLUMN "totalPricePence" INTEGER;

UPDATE "Booking" b
SET
  "serviceNameAtBooking" = s."name",
  "servicePricePenceAtBooking" = s."pricePence",
  "serviceDurationMinutesAtBooking" = s."durationMinutes",
  "totalPricePence" = s."pricePence"
FROM "Service" s
WHERE b."serviceId" = s."id"
  AND (b."serviceNameAtBooking" IS NULL OR b."servicePricePenceAtBooking" IS NULL OR b."serviceDurationMinutesAtBooking" IS NULL OR b."totalPricePence" IS NULL);

CREATE INDEX "Service_active_displayOrder_idx" ON "Service"("active", "displayOrder");
