import {
  KERSIVO_COMMISSION_CLAIM,
  SMS_INCLUDED_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';

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
  introCommission: `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  launchSubtext:
    'Hosting, SSL, domain renewal, support, platform updates, and 1h minor changes/month — same Care on every plan.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain purchase, management and renewal while Care is active',
    `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    'Hosting + SSL included while Care is active',
    `Ongoing Care (£39/mo): ${SMS_INCLUDED_CLAIM} Support, platform updates, 1h minor changes/month`,
  ],
  launchNewcomerAnchor:
    `Live booking on your own domain in about two weeks. ${KERSIVO_COMMISSION_CLAIM}`,
  launchSwitcherAnchor:
    'Switch from a marketplace profile to a booking experience built around your brand — with predictable setup and flat monthly Care.',
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
    'Flat Care keeps margin predictable as chairs and volume grow. Standard Stripe payment-processing fees still apply.',
  launchCtaLabel: 'Plan my setup on Launch',
  priorityCtaLabel: 'Plan my setup on Priority Growth',
};

const LANDING_COPY: Pricing36Copy = {
  introCommission: `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  launchSubtext:
    'Hosting, SSL, domain renewal, support, platform updates, and 1 hour of minor changes each month — same Care on every plan.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain purchase, management and renewal while Care is active',
    `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    'Hosting + SSL included while Care is active',
    `Ongoing Care (£39/mo): ${SMS_INCLUDED_CLAIM} Support, platform updates, and 1 hour of minor changes each month`,
  ],
  launchNewcomerAnchor:
    `Typical go-live: around two weeks after onboarding. ${KERSIVO_COMMISSION_CLAIM}`,
  launchSwitcherAnchor:
    'Switch from a marketplace profile to a booking experience built around your brand — with predictable setup and flat monthly Care.',
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
    'Flat Care keeps margin predictable as chairs and volume grow. Standard Stripe payment-processing fees still apply.',
  launchCtaLabel: 'Plan My Setup — Launch',
  priorityCtaLabel: 'Plan My Setup — Priority Growth',
};

export function getPricing36Copy(variant: Pricing36Variant = 'default'): Pricing36Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}
