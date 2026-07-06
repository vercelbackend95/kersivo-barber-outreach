export type Pricing36Variant = 'default' | 'landing';

export type Pricing36Copy = {
  introCommission: string;
  launchSubtext: string;
  launchBullets: string[];
  launchNewcomerAnchor: string;
  prioritySubtext: string;
  priorityBullets: string[];
  priorityNewcomerAnchor: string;
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
};

const LANDING_COPY: Pricing36Copy = {
  introCommission: 'KERSIVO never takes a cut of your bookings or retail.',
  launchSubtext:
    'Hosting, SMS, support, platform updates, and 1 hour of scoped site or booking tweaks each month.',
  launchBullets: [
    'Custom site + booking + admin + pickup shop setup',
    'Domain setup + deployment handled by us',
    '0% KERSIVO commission (Stripe card fees only)',
    'Hosting + SSL included while subscription is active',
    'Ongoing Care: SMS, no-show protection, support, and platform updates',
  ],
  launchNewcomerAnchor:
    'Typical setup target: around two weeks once your onboarding details are complete. 0% commission from booking #1.',
  prioritySubtext:
    'Same £39/month Care as Launch — priority launch queue and extra setup polish during the build.',
  priorityBullets: [
    'Everything in Launch',
    'Priority launch queue during setup',
    'Extra polish for key pages and your product catalogue',
    'Same Ongoing Care: hosting, SMS, support, and 1 hour of scoped tweaks each month',
  ],
  priorityNewcomerAnchor:
    'Typical setup target: around two weeks once your onboarding details are complete.',
};

export function getPricing36Copy(variant: Pricing36Variant = 'default'): Pricing36Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}
