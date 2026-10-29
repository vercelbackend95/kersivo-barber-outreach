import type { BookingFlowPresentation } from '@/components/booking/bookingPresentation';

/**
 * Test-mode booking on a private preview (spec §6). The page renders BookingFlow in publicDemoMode with
 * the draft shop's real services and barbers: slots are static, and completing a booking only shows a
 * confirmation screen — no API request is made, so no booking, payment, email or Stripe call can happen.
 */
export function previewBookingPresentation(shopName: string): BookingFlowPresentation {
  return {
    eyebrow: shopName,
    title: 'Book an appointment',
    sandboxNote: 'Test bookings only — no payments are taken. Times shown are examples.',
    confirmEyebrow: 'Test booking',
    confirmHeading: 'Test booking complete',
    confirmBody:
      'This was a test on your private preview: no appointment was created, no payment was taken and no emails were sent.',
    confirmCtas: [],
    submitLabel: 'Complete test booking',
    skipCompletionAnalytics: true,
  };
}
