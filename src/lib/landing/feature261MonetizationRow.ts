import { adminDemoHref } from '@/lib/admin/demoConfig';

export const FEATURE261_MONETIZATION_ROW = {
  kicker: 'REPORTS & PERFORMANCE',
  heading: 'See bookings, service value and barber performance in one place.',
  description:
    'Track booked and completed service value, deposits, booking trends and shop performance.',
  ctaLabel: 'Explore reports',
  ctaHref: adminDemoHref('reports'),
  ctaTrack: 'view_live_demo_click',
  ctaSameTab: false,
} as const;
