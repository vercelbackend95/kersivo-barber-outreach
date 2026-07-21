import {
  KERSIVO_COMMISSION_CLAIM,
  SMS_INCLUDED_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export type Pricing36Variant = 'default' | 'landing';

export type Pricing36Copy = {
  introCommission: string;
  headline: string;
  introLead: string;
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
  /** Pure SaaS card (when setup packages are hidden). */
  saasTitle: string;
  saasSubtext: string;
  saasBullets: string[];
  saasSwitcherAnchor: string;
  saasNewcomerAnchor: string;
  saasCtaLabel: string;
};

const SAAS_BULLETS_DEFAULT = [
  'Standard branded website + booking + admin + pickup shop setup',
  'Domain purchase, management and renewal while your subscription is active',
  `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  'Hosting + SSL included while your subscription is active',
  `${SMS_INCLUDED_CLAIM}. Support, platform updates, 1h minor changes/month`,
];

const SAAS_BULLETS_LANDING = [
  'Standard branded website + booking + admin + pickup shop setup',
  'Domain purchase, management and renewal while your subscription is active',
  `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  'Hosting + SSL included while your subscription is active',
  `${SMS_INCLUDED_CLAIM}. Support, platform updates, and 1 hour of minor changes each month`,
];

const DEFAULT_COPY: Pricing36Copy = {
  introCommission: `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  headline: 'ONE MONTHLY FEE. ZERO KERSIVO COMMISSION.',
  introLead: `KERSIVO — £${SAAS_MONTHLY_GBP}/month.`,
  launchSubtext:
    'Hosting, SSL, domain renewal, support, platform updates, and 1h minor changes/month — same Care on every plan.',
  launchBullets: [
    'Standard branded website + booking + admin + pickup shop setup',
    'Domain purchase, management and renewal while Care is active',
    `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    'Hosting + SSL included while Care is active',
    `Ongoing Care (£${SAAS_MONTHLY_GBP}/mo): ${SMS_INCLUDED_CLAIM}. Support, platform updates, 1h minor changes/month`,
  ],
  launchNewcomerAnchor: `Live booking on your own domain in about two weeks. ${KERSIVO_COMMISSION_CLAIM}`,
  launchSwitcherAnchor:
    'Switch from a marketplace profile to a booking experience built around your brand — with predictable setup and flat monthly Care.',
  prioritySubtext: `Same £${SAAS_MONTHLY_GBP}/month Care as Launch — extra dedicated pages and deeper catalogue polish in the setup.`,
  priorityBullets: [
    'Everything in Launch',
    'Extra dedicated pages beyond the main landing (e.g. gallery) — scoped with you at setup',
    'Deeper product-catalogue polish',
    `Same £${SAAS_MONTHLY_GBP}/month Ongoing Care as Launch`,
  ],
  priorityNewcomerAnchor:
    'More room for dedicated pages and catalogue depth if you want a fuller site from day one.',
  prioritySwitcherAnchor:
    'Flat Care keeps margin predictable as chairs and volume grow. Standard Stripe payment-processing fees still apply.',
  launchCtaLabel: 'Plan my setup on Launch',
  priorityCtaLabel: 'Plan my setup on Priority Growth',
  saasTitle: 'KERSIVO',
  saasSubtext:
    'Everything you need to run booking, retail and admin on your own domain — billed monthly, cancel anytime.',
  saasBullets: SAAS_BULLETS_DEFAULT,
  saasSwitcherAnchor:
    'Switch from a marketplace profile to a booking experience built around your brand — flat monthly fee, no setup fee.',
  saasNewcomerAnchor: `Live booking on your own domain in about two weeks. ${KERSIVO_COMMISSION_CLAIM}`,
  saasCtaLabel: `Get started — £${SAAS_MONTHLY_GBP}/mo`,
};

const LANDING_COPY: Pricing36Copy = {
  introCommission: `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  headline: 'ONE MONTHLY FEE. ZERO KERSIVO COMMISSION.',
  introLead: `KERSIVO — £${SAAS_MONTHLY_GBP}/month.`,
  launchSubtext:
    'Hosting, SSL, domain renewal, support, platform updates, and 1 hour of minor changes each month — same Care on every plan.',
  launchBullets: [
    'Standard branded website + booking + admin + pickup shop setup',
    'Domain purchase, management and renewal while Care is active',
    `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    'Hosting + SSL included while Care is active',
    `Ongoing Care (£${SAAS_MONTHLY_GBP}/mo): ${SMS_INCLUDED_CLAIM}. Support, platform updates, and 1 hour of minor changes each month`,
  ],
  launchNewcomerAnchor: `Typical go-live: around two weeks after onboarding. ${KERSIVO_COMMISSION_CLAIM}`,
  launchSwitcherAnchor:
    'Switch from a marketplace profile to a booking experience built around your brand — with predictable setup and flat monthly Care.',
  prioritySubtext: `Same £${SAAS_MONTHLY_GBP}/month Care as Launch — extra dedicated pages and deeper catalogue polish in the setup.`,
  priorityBullets: [
    'Everything in Launch',
    'Extra dedicated pages beyond the main landing (e.g. gallery) — scoped with you at setup',
    'Deeper product-catalogue polish',
    `Same £${SAAS_MONTHLY_GBP}/month Ongoing Care as Launch`,
  ],
  priorityNewcomerAnchor:
    'More room for dedicated pages and catalogue depth if you want a fuller site from day one.',
  prioritySwitcherAnchor:
    'Flat Care keeps margin predictable as chairs and volume grow. Standard Stripe payment-processing fees still apply.',
  launchCtaLabel: 'Plan My Setup — Launch',
  priorityCtaLabel: 'Plan My Setup — Priority Growth',
  saasTitle: 'KERSIVO',
  saasSubtext:
    'Everything you need to run booking, retail and admin on your own domain — billed monthly, cancel anytime.',
  saasBullets: SAAS_BULLETS_LANDING,
  saasSwitcherAnchor:
    'Switch from a marketplace profile to a booking experience built around your brand — flat monthly fee, no setup fee.',
  saasNewcomerAnchor: `Typical go-live: around two weeks after onboarding. ${KERSIVO_COMMISSION_CLAIM}`,
  saasCtaLabel: `Get started — £${SAAS_MONTHLY_GBP}/mo`,
};

export function getPricing36Copy(variant: Pricing36Variant = 'default'): Pricing36Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}
