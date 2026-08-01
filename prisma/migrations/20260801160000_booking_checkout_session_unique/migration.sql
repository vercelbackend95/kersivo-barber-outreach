-- Ensure one Stripe Checkout Session maps to at most one booking.
CREATE UNIQUE INDEX "Booking_stripeCheckoutSessionId_key" ON "Booking"("stripeCheckoutSessionId");
