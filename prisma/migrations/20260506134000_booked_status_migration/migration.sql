-- Replace CONFIRMED/PENDING_CONFIRMATION with BOOKED.
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";

CREATE TYPE "BookingStatus" AS ENUM (
  'BOOKED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_ADMIN',
  'CANCELLED_BY_SHOP',
  'RESCHEDULED',
  'EXPIRED',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'NO_SHOW'
);

ALTER TABLE "Booking"
  ALTER COLUMN "status" TYPE "BookingStatus"
  USING (
    CASE
      WHEN "status"::text IN ('CONFIRMED', 'PENDING_CONFIRMATION') THEN 'BOOKED'
      ELSE "status"::text
    END
  )::"BookingStatus";

ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'BOOKED';

DROP TYPE "BookingStatus_old";
