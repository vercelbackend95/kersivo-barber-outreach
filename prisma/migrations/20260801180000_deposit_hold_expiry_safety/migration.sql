-- AlterEnum: late-payment refund notice to client
ALTER TYPE "EmailOutboundPurpose" ADD VALUE 'DEPOSIT_REFUNDED_SLOT_LOST';

-- Align schema with index created in 20260727170000_add_booking_deposits_connect
-- (Booking_status_paymentExpiresAt_idx). Create only if missing so migrate is idempotent.
CREATE INDEX IF NOT EXISTS "Booking_status_paymentExpiresAt_idx" ON "Booking"("status", "paymentExpiresAt");
