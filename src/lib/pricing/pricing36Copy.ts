export type Pricing36Variant = 'default' | 'landing';

export type Pricing36Copy = {
  introCommission: string;
  launchSubtext: string;
  launchBullets: string[];
  launchNewcomerAnchor: string;
  launchSwitcherAnchor: string;
  prioritySubtext: string;
  priorityBullets: string[];
  priorityNewcomerAnchor: string;
  prioritySwitcherAnchor: string;
  launchCtaLabel: string;
  priorityCtaLabel: string;
};

const DEFAULT_COPY: Pricing36Copy = {
  introCommission: 'Kersivo never takes a cut of your bookings or retail.',
  launchSubtext:
    'Hosting, SMS, support, platform updates, and 1h scoped tweaks/month — same Care on every plan.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain setup + deployment handled by us',
    '0% Kersivo commission (Stripe card fees only)',
    'Hosting + SSL included while Care is active',
    'Ongoing Care (£39/mo): SMS, no-show protection, support, platform updates, 1h scoped tweaks/month',
  ],
  launchNewcomerAnchor:
    'Live booking on your own domain in about two weeks. 0% commission from booking #1.',
  launchSwitcherAnchor:
    "Compare your current platform costs with Kersivo's predictable setup and flat monthly Care.",
  prioritySubtext:
    'Same £39/month Care as Launch — extra dedicated pages and deeper catalogue polish in the setup.',
  priorityBullets: [
    'Everything in Launch',
    'Extra dedicated pages beyond the main landing (e.g. gallery) — scoped with you at setup',
    'Deeper product-catalogue polish',
    'Same £39/month Ongoing Care as Launch',
  ],
  priorityNewcomerAnchor:
    'More room for dedicated pages and catalogue depth if you want a fuller site from day one.',
  prioritySwitcherAnchor:
    'When marketplace fees scale with chairs and volume, a flat Care plan keeps margin predictable next to Stripe only.',
  launchCtaLabel: 'Plan my setup on Launch',
  priorityCtaLabel: 'Plan my setup on Priority Growth',
};

const LANDING_COPY: Pricing36Copy = {
  introCommission: 'KERSIVO never takes a cut of your bookings or retail.',
  launchSubtext:
    'Hosting, SMS, support, platform updates, and 1 hour of scoped tweaks each month — same Care on every plan.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain setup + deployment handled by us',
    '0% KERSIVO commission (Stripe card fees only)',
    'Hosting + SSL included while Care is active',
    'Ongoing Care (£39/mo): SMS, no-show protection, support, platform updates, and 1 hour of scoped tweaks each month',
  ],
  launchNewcomerAnchor:
    'Typical go-live: around two weeks after onboarding. 0% commission from booking #1.',
  launchSwitcherAnchor:
    "Compare your current platform costs with KERSIVO's predictable setup and flat monthly Care.",
  prioritySubtext:
    'Same £39/month Care as Launch — extra dedicated pages and deeper catalogue polish in the setup.',
  priorityBullets: [
    'Everything in Launch',
    'Extra dedicated pages beyond the main landing (e.g. gallery) — scoped with you at setup',
    'Deeper product-catalogue polish',
    'Same £39/month Ongoing Care as Launch',
  ],
  priorityNewcomerAnchor:
    'More room for dedicated pages and catalogue depth if you want a fuller site from day one.',
  prioritySwitcherAnchor:
    'Flat Care keeps margin predictable as chairs and volume grow — Stripe only on cards.',
  launchCtaLabel: 'Plan My Setup — Launch',
  priorityCtaLabel: 'Plan My Setup — Priority Growth',
};

export function getPricing36Copy(variant: Pricing36Variant = 'default'): Pricing36Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}
