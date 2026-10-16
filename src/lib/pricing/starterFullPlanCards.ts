/**
 * Shared Starter vs Full plan-card content for /starter and
 * /barbershop-online-booking Section 07.
 */
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const STARTER_FULL_PLAN_STARTER_FEATURES = [
  'KERSIVO-hosted booking page',
  'Up to 4 active bookable barbers',
  'Bookings, team, services and availability',
  'Manage bookings in your shop diary',
  'Rolling 90-day booking history',
  'Clients Core',
  'Automated email reminders',
  '£5 deposit or Pay in full on every public booking',
  'Guided Google booking-link setup',
  'Included initial QR Kit for eligible verified UK locations',
] as const;

/** Full-only extras shown on the Full card. Full owners control public booking payment mode (NONE / DEPOSIT / FULL). */
export const STARTER_FULL_PLAN_FULL_ONLY = [
  'Your own branded website and domain',
  'More than 4 active bookable barbers',
  'Full booking history',
  'Advanced Clients / CRM',
  'Reports',
  'Retail, Products, Orders and Sales',
  'SMS reminders',
  'Live KERSIVO Assistant',
  'Owner-controlled payments: Pay at shop, £5 deposit or Pay in full',
] as const;

export const STARTER_FULL_PLAN_STARTER_CTA = {
  label: 'Start KERSIVO Starter',
  href: '/admin',
  trackEvent: 'starter_signup_click',
} as const;

export const STARTER_FULL_PLAN_FULL_CTA = {
  label: 'See Full KERSIVO pricing',
  href: '/pricing#plan',
  trackEvent: 'plan_my_setup_click',
} as const;

export const STARTER_FULL_PLAN_MONTHLY_GBP = SAAS_MONTHLY_GBP;

export const STARTER_FULL_PLAN_INTRO =
  'Everything in the Starter booking operation, plus the full KERSIVO ownership layer:';
