export type RateCard1Variant = 'default' | 'landing';

export type RateCard1Copy = {
  ongoingCareBullets: string[];
  leadCommissionLabel: string;
  bookingShopDescription: string;
  alwaysOnDescription: string;
  clientCommsDescription: string;
};

const SHARED = {
  humansOnCallDescription:
    'Support inbox for day-to-day questions, plus up to one hour of scoped site or booking tweaks each month.',
  keepsScalingDescription:
    'We ship platform updates so the system stays fast and handles more barbers and chairs as your shop grows.',
} as const;

const DEFAULT_COPY: RateCard1Copy = {
  ongoingCareBullets: [
    'Online booking — 0% Kersivo commission',
    'Your shop online — 0% Kersivo commission on retail',
    'SMS reminders when you enable them',
    'No-show protection on bookings',
    'Hosting, SSL, admin + shop live 24/7',
    'Support inbox + 1 hour scoped tweaks/month',
    'Platform updates — performance and scale as you add barbers and chairs',
  ],
  leadCommissionLabel: '0% Kersivo commission',
  bookingShopDescription:
    'Clients book and buy on your domain. Kersivo never takes a cut of bookings or retail; Stripe charges cards on your account only.',
  alwaysOnDescription:
    'Hosting, SSL renewal, admin panel and pickup shop stay reachable 24/7 — infra noise stays off your weekends.',
  clientCommsDescription:
    'SMS reminders fire when you enable them. No-show protection helps cut empty chairs without awkward chase-ups.',
};

const LANDING_COPY: RateCard1Copy = {
  ongoingCareBullets: [
    'Online booking — 0% KERSIVO commission',
    'Retail pickup shop — 0% KERSIVO commission',
    'SMS reminders when you enable them',
    'No-show protection on bookings',
    'Hosting, SSL, admin + shop live 24/7',
    'Support inbox + 1 hour of scoped tweaks each month',
    'Platform updates — performance and scale as you add barbers and chairs',
  ],
  leadCommissionLabel: '0% KERSIVO commission',
  bookingShopDescription:
    'Clients book and buy on your domain. KERSIVO never takes a cut of bookings or retail; Stripe charges cards on your account only.',
  alwaysOnDescription:
    'Hosting, SSL renewal, admin panel and pickup shop stay reachable 24/7 — the technical side stays handled.',
  clientCommsDescription:
    'SMS reminders are sent when you enable them. No-show protection helps cut empty chairs without awkward chase-ups.',
};

export function getRateCard1Copy(variant: RateCard1Variant = 'default'): RateCard1Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}

export { SHARED as rateCard1SharedCopy };
