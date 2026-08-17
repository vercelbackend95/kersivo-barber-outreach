import type { BookingFlowPresentation } from '@/components/booking/bookingPresentation';

export const BLACKLINE_BOOKING_PRESENTATION: BookingFlowPresentation = {
  eyebrow: 'Blackline Barbers',
  title: 'Book a chair',
  sandboxNote:
    'This is a fictional Blackline Barbers booking. No appointment is created, no payment is taken, and the details you enter are not stored.',
  confirmEyebrow: 'Demo complete',
  confirmHeading: 'That’s the Blackline booking experience',
  confirmBody:
    'No appointment was created and no email was sent. This walkthrough stays inside the Blackline demo.',
  confirmCtas: [
    { label: 'Back to Blackline', href: '/demo', primary: true },
    { label: 'View services', href: '/demo/services', primary: false },
  ],
  demoReferencePrefix: 'BL',
  skipCompletionAnalytics: true,
  wholePoundPrices: true,
};
