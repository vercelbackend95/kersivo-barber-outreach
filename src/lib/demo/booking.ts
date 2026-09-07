import type { BookingFlowPresentation } from '@/components/booking/bookingPresentation';

export const BLACKLINE_TIMELINE_CTA_LABEL = 'View booking timeline';

export const BLACKLINE_BOOKING_PRESENTATION: BookingFlowPresentation = {
  eyebrow: 'Blackline Barbers',
  title: 'Book a chair',
  sandboxNote:
    'This is a fictional Blackline Barbers booking. No appointment is created, no payment is taken, and your demo details stay in this browser session and are cleared automatically.',
  confirmEyebrow: 'Demo complete',
  confirmHeading: "You're all set",
  confirmBody: 'Demo only — no appointment or email was created.',
  confirmCtas: [{ label: 'Back to Blackline', href: '/demo', primary: false }],
  demoReferencePrefix: 'BL',
  skipCompletionAnalytics: true,
  wholePoundPrices: true,
};
