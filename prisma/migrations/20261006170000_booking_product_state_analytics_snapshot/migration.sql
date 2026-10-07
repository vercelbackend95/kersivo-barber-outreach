-- Additive analytics snapshot for public booking attribution across later plan changes.
ALTER TABLE "Booking"
ADD COLUMN "kersivoProductStateAtBooking" TEXT;

CREATE INDEX "Booking_kersivoProductStateAtBooking_paidAt_idx"
ON "Booking"("kersivoProductStateAtBooking", "paidAt");
