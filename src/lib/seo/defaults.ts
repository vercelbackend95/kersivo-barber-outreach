export const SITE_NAME = 'KERSIVO';

export const DEFAULT_TITLE = 'Barbershop Software & Barber Booking System UK | KERSIVO';

export const DEFAULT_OG_IMAGE_PATH = '/images/og/kersivo-og.jpg';

/** Default Open Graph image dimensions (kersivo-og.jpg). */
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT =
  'KERSIVO — UK barbershop software. Full £39/month with your own branded website and domain, Starter £0/month. 0% KERSIVO commission';

export const ONGOING_CARE_MONTHLY_GBP = 39;

/** Public SaaS monthly fee (same amount; preferred name in purchase UI). */
export const SAAS_MONTHLY_GBP = ONGOING_CARE_MONTHLY_GBP;

export const DEFAULT_DESCRIPTION =
  'UK barbershop software with your own branded website, domain and online bookings. Full KERSIVO is £39/month per location, with 0% KERSIVO commission.';

/** Homepage-only description. Other pages fall back to DEFAULT_DESCRIPTION via meta.ts. */
export const HOMEPAGE_DESCRIPTION = `Your own branded barbershop website, domain and online booking for £${SAAS_MONTHLY_GBP}/month per location, not per barber. No setup fee, no VAT added. Stripe fees apply.`;

/** Homepage meta description while FREE_PREVIEW_FLOW_ENABLED is on (docs/free-preview-spec.md §10.3). */
export const HOMEPAGE_FREE_PREVIEW_DESCRIPTION = `Your own branded barbershop website, domain and online booking for £${SAAS_MONTHLY_GBP}/month per location. See a free personalised preview first — no card needed.`;

export function getHomepageDescription(freePreview = false): string {
  return freePreview ? HOMEPAGE_FREE_PREVIEW_DESCRIPTION : HOMEPAGE_DESCRIPTION;
}

export const HOMEPAGE_LAST_UPDATED_ISO = '2026-10-28';

export const SAAS_MONTHLY_PENCE = SAAS_MONTHLY_GBP * 100;

/** KERSIVO does not currently add VAT to its subscription. */
export const SAAS_ADDS_VAT = false;

/**
 * KERSIVO online booking deposit (GBP). Must match `BOOKING_DEPOSIT_PENCE` in
 * `src/lib/booking/depositGate.ts`, which is server-coupled and cannot be imported client-side.
 */
export const KERSIVO_BOOKING_DEPOSIT_GBP = 5;

export const PAGE_DESCRIPTIONS = {
  privacy:
    'Privacy policy for KERSIVO barbershop booking and retail software. How we process personal data for UK barbershops and their clients.',
  cookies:
    'Cookie policy for KERSIVO. How we use necessary cookies, analytics and advertising measurement, and how to change your choices.',
  terms:
    'Terms of service for KERSIVO barbershop website, booking, and retail pickup software for UK business customers.',
  dpa:
    'Data Processing Agreement for KERSIVO. How KERSIVO processes Customer Personal Data as a processor for UK barbershop clients.',
  shop:
    'Interactive KERSIVO retail demo — browse grooming products and try the demo bag. No payment is taken and no order is created.',
  setupSuccess:
    'Your KERSIVO subscription is confirmed. Continue your setup to prepare your barbershop for launch.',
  setupCancel:
    'KERSIVO subscription checkout was cancelled. No payment was taken.',
  book:
    'Try the KERSIVO interactive booking demo — choose a service, barber, and time. No appointment is created and nothing you enter is stored.',
  bookConfirm:
    'Your barbershop appointment is confirmed. You will receive a confirmation email with booking details.',
  bookCancel:
    'Cancel your barbershop appointment online. Manage your booking without calling the shop.',
  bookReschedule:
    'Reschedule your barbershop appointment — pick a new date and time slot online.',
  admin:
    'KERSIVO admin panel for barbershops — manage bookings, team, services, clients, and retail orders.',
  adminDemo:
    'Safe preview of the KERSIVO admin dashboard with example barbershop data — no signup or password required.',
  shopSuccess:
    'Your grooming product pickup order is confirmed. Collect your items on your next barbershop visit.',
  shopCancelled:
    'Your KERSIVO shop checkout was cancelled. No payment was taken.',
  barbershopBookingSystem:
    'Booking and admin for independent UK barbershops. Starter £0/month; Full £39/month adds your own domain and retail pickup. 0% KERSIVO commission.',
  booksyAlternative:
    'Looking for a Booksy alternative for your barbershop? Compare KERSIVO and Booksy across branding, pricing, bookings, marketplace discovery and client experience.',
} as const;
