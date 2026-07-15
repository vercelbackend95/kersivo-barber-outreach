import { adminDemoHref } from '@/lib/admin/demoConfig';

export const FEATURE261_MONETIZATION_ROW = {
  kicker: 'REPORTS & REVENUE',
  heading: 'See bookings, revenue and barber performance in one place.',
  description:
    'Track daily revenue, booking totals, cancellations and barber performance from the same admin.',
  ctaLabel: 'Build My KERSIVO Workspace',
  ctaHref: '/admin/onboarding',
  ctaTrack: 'plan_my_setup_click',
  ghostCtaLabel: 'See Reports in Action',
  ghostCtaHref: adminDemoHref('reports'),
} as const;
