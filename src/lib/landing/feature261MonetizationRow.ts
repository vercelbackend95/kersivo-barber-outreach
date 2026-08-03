import { adminDemoHref } from '@/lib/admin/demoConfig';

export const FEATURE261_MONETIZATION_ROW = {
  kicker: 'REPORTS & REVENUE',
  heading: 'See bookings, revenue and barber performance in one place.',
  description:
    'Track daily revenue, booking totals, cancellations and barber performance from the same admin.',
  ctaLabel: 'Explore reports',
  ctaHref: adminDemoHref('reports'),
  ctaTrack: 'view_live_demo_click',
  ctaSameTab: false,
} as const;
