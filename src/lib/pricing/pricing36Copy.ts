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
  questionsSuffix: string;
};

const DEFAULT_COPY: Pricing36Copy = {
  introCommission: 'Kersivo never takes a cut of your bookings or retail.',
  launchSubtext:
    'Hosting, SMS, support, platform updates, and 1h scoped tweaks/month — same Care on every plan.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain setup + deployment handled by us',
    '0% Kersivo commission (Stripe card fees only)',
    'Hosting + SSL included while subscription is active',
    'Ongoing Care: SMS, no-show protection, support, platform updates, 1h tweaks/month',
  ],
  launchNewcomerAnchor:
    'Live booking on your own domain in about two weeks. 0% commission from booking #1.',
  launchSwitcherAnchor:
    'Many busy shops on marketplace apps see subscription plus traffic-related fees in the ~£120–£300/mo range — line it up with your own statements.',
  prioritySubtext:
    'Same £39/month Care as Launch — extra setup polish and priority launch queue during the build.',
  priorityBullets: [
    'Everything in Launch',
    'Priority launch queue during setup',
    'Extra setup polish for key pages and product catalogue depth',
    'Same Ongoing Care: hosting, SMS, support, platform updates, 1h tweaks/month',
  ],
  priorityNewcomerAnchor:
    'Faster launch queue and deeper catalogue setup if you want to grow harder from day one.',
  prioritySwitcherAnchor:
    'When marketplace fees scale with chairs and volume, a flat Care plan keeps margin predictable next to Stripe only.',
  launchCtaLabel: 'Plan my setup on Launch',
  priorityCtaLabel: 'Plan my setup on Priority Growth',
  questionsSuffix: '— or use the contact form below.',
};

const LANDING_COPY: Pricing36Copy = {
  introCommission: 'KERSIVO never takes a cut of your bookings or retail.',
  launchSubtext:
    'Hosting, SMS, support, platform updates, and 1 hour of scoped tweaks each month.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain setup + deployment handled by us',
    '0% KERSIVO commission (Stripe card fees only)',
    'Hosting + SSL included while subscription is active',
    'Ongoing Care: SMS, no-show protection, support, and platform updates',
  ],
  launchNewcomerAnchor:
    'Typical go-live: around two weeks after onboarding. 0% commission from booking #1.',
  launchSwitcherAnchor:
    'Marketplace apps often run ~£120–£300/mo in subscription and traffic-related fees — compare with your own statements.',
  prioritySubtext:
    'Same £39/month Care as Launch — priority queue and extra polish during the build.',
  priorityBullets: [
    'Everything in Launch',
    'Priority launch queue during setup',
    'Extra polish for key pages and your product catalogue',
    'Same Ongoing Care: hosting, SMS, support, and 1 hour of scoped tweaks each month',
  ],
  priorityNewcomerAnchor: 'Typical go-live: around two weeks after onboarding.',
  prioritySwitcherAnchor:
    'Flat Care keeps margin predictable as chairs and volume grow — Stripe only on cards.',
  launchCtaLabel: 'Plan My Setup — Launch',
  priorityCtaLabel: 'Plan My Setup — Priority Growth',
  questionsSuffix: '',
};

export function getPricing36Copy(variant: Pricing36Variant = 'default'): Pricing36Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}
