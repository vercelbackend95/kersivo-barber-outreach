DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Booking'
      AND column_name = 'serviceNameAtBooking'
  ) THEN
    ALTER TABLE "Booking" ADD COLUMN "serviceNameAtBooking" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Booking'
      AND column_name = 'servicePricePenceAtBooking'
  ) THEN
    ALTER TABLE "Booking" ADD COLUMN "servicePricePenceAtBooking" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Booking'
      AND column_name = 'serviceDurationMinutesAtBooking'
  ) THEN
    ALTER TABLE "Booking" ADD COLUMN "serviceDurationMinutesAtBooking" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Booking'
      AND column_name = 'totalPricePence'
  ) THEN
    ALTER TABLE "Booking" ADD COLUMN "totalPricePence" INTEGER;
  END IF;
END $$;

UPDATE "Booking" b
SET
  "serviceNameAtBooking" = COALESCE(b."serviceNameAtBooking", s."name"),
  "servicePricePenceAtBooking" = COALESCE(b."servicePricePenceAtBooking", s."pricePence"),
  "serviceDurationMinutesAtBooking" = COALESCE(b."serviceDurationMinutesAtBooking", s."durationMinutes"),
  "totalPricePence" = COALESCE(b."totalPricePence", s."pricePence")
FROM "Service" s
WHERE b."serviceId" = s."id"
  AND (
    b."serviceNameAtBooking" IS NULL
    OR b."servicePricePenceAtBooking" IS NULL
    OR b."serviceDurationMinutesAtBooking" IS NULL
    OR b."totalPricePence" IS NULL
  );
