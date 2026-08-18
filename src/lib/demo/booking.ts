import type { BookingFlowPresentation } from '@/components/booking/bookingPresentation';

export const BLACKLINE_TIMELINE_CTA_LABEL = 'See your booking on the timeline';

export const BLACKLINE_BOOKING_PRESENTATION: BookingFlowPresentation = {
  eyebrow: 'Blackline Barbers',
  title: 'Book a chair',
  sandboxNote:
    'This is a fictional Blackline Barbers booking. No appointment is created, no payment is taken, and your demo details stay in this browser session and are cleared automatically.',
  confirmEyebrow: 'Demo complete',
  confirmHeading: 'That’s the Blackline booking experience',
  confirmBody:
    'Your demo appointment has been added to this browser session. No real appointment was created and no email was sent.',
  confirmCtas: [{ label: 'Back to Blackline', href: '/demo', primary: false }],
  demoReferencePrefix: 'BL',
  skipCompletionAnalytics: true,
  wholePoundPrices: true,
};
