import { adminDemoHref } from '@/lib/admin/demoConfig';

export const FEATURE261_MONETIZATION_ROW = {
  kicker: 'MONETIZATION',
  heading: 'Revenue, bookings, cancel rate—see how the day is tracking.',
  description:
    'Track booking revenue, daily totals and how performance breaks down across the team. Charts and KPIs live in the same signed-in admin as the timeline and shop.',
  ctaLabel: 'See the reports',
  ctaHref: adminDemoHref('reports'),
} as const;
