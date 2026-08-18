export type BookingDemoConfirmCta = {
  label: string;
  href: string;
  primary?: boolean;
};

export type PostConfirmCtaConfig = {
  label: string;
  /** Admin timeline deep-link after a booking. */
  destination: 'admin-timeline';
  /** Base path for the owner dashboard. Defaults to `/admin`. */
  adminBasePath?: string;
  /** When true, the CTA is also shown on public-demo confirmations. */
  availableForDemo?: boolean;
};

export type BookingFlowPresentation = {
  eyebrow?: string;
  title?: string;
  sandboxNote?: string;
  confirmEyebrow?: string;
  confirmHeading?: string;
  confirmBody?: string;
  confirmCtas?: readonly BookingDemoConfirmCta[];
  demoReferencePrefix?: string;
  skipCompletionAnalytics?: boolean;
  wholePoundPrices?: boolean;
};

export function buildAdminTimelineHref(options: {
  adminBasePath?: string;
  bookingId: string;
  bookingDate: string;
  demoJourney?: boolean;
}): string {
  const base = (options.adminBasePath?.trim() || '/admin').replace(/\/$/, '') || '/admin';
  const params = new URLSearchParams({
    section: 'bookings_dashboard',
    bookingId: options.bookingId,
    bookingDate: options.bookingDate,
  });
  if (options.demoJourney) params.set('demoJourney', 'booking');
  return `${base}?${params.toString()}`;
}
