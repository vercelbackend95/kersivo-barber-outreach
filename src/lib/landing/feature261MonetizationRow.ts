import { adminDemoHref } from '@/lib/admin/demoConfig';

export const FEATURE261_MONETIZATION_ROW = {
  kicker: 'MONETIZATION',
  heading: 'Shop sales, payouts, barber income—see what you earned.',
  description:
    'Track retail revenue, order totals and how income breaks down across the team. Sales charts and KPIs live in the same signed-in admin as bookings and the shop.',
  ctaLabel: 'See the KPIs',
  ctaHref: adminDemoHref('kpis'),
} as const;
