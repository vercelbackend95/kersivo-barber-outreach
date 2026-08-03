import {
  BILLING_CYCLE_SHORT,
  CLIENT_COMMS_CLAIM,
  DOMAIN_INCLUDED_SHORT,
  KERSIVO_COMMISSION_CLAIM,
  KERSIVO_COMMISSION_WITH_STRIPE,
  NO_SETUP_FEE_SHORT,
  PLAN_SCOPE_HIGHLIGHTS,
  PLAN_SCOPE_PILLS,
  PLAN_SCOPE_SHORT,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export type RateCard1Variant = 'default' | 'landing';

export type RateCard1Copy = {
  ongoingCareBullets: string[];
  planPills: string[];
  planSubtext: string;
  ctaLabel: string;
  leadCommissionLabel: string;
  bookingShopDescription: string;
  alwaysOnDescription: string;
  clientCommsDescription: string;
};

export type RateCard1LandingIcon =
  | 'globe'
  | 'dashboard'
  | 'users'
  | 'shoppingBag'
  | 'scissors'
  | 'chart';

export type RateCard1LandingIncludedItem = {
  heading: string;
  description: string;
  icon: RateCard1LandingIcon;
};

export type RateCard1LandingLayout = {
  eyebrow: string;
  /** Heading before dynamic £price/month */
  headingBeforePrice: string;
  /** Heading after dynamic £price (e.g. "/month") */
  headingAfterPrice: string;
  lead: string;
  planLabel: string;
  planValueLine: string;
  trustPoints: string[];
  ctaLabel: string;
  checkoutNote: string;
  billingNote: string;
  includedHeading: string;
  includedItems: RateCard1LandingIncludedItem[];
  supportItems: string[];
  conditionsLine1: string;
  conditionsLine2: string;
};

const SHARED = {
  humansOnCallDescription:
    'Support inbox for day-to-day questions, plus up to one hour of minor development changes each month.',
  keepsScalingDescription:
    'We ship platform and security updates so the system stays maintained as your shop grows.',
} as const;

const PLAN_SUBTEXT = `${NO_SETUP_FEE_SHORT} ${PLAN_SCOPE_SHORT} ${DOMAIN_INCLUDED_SHORT} ${BILLING_CYCLE_SHORT} Cancel anytime.`;

const DEFAULT_COPY: RateCard1Copy = {
  ongoingCareBullets: [...PLAN_SCOPE_HIGHLIGHTS],
  planPills: [...PLAN_SCOPE_PILLS],
  planSubtext: PLAN_SUBTEXT,
  ctaLabel: `Get started — £${SAAS_MONTHLY_GBP}/mo`,
  leadCommissionLabel: KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''),
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_WITH_STRIPE}`,
  alwaysOnDescription:
    'Hosting, SSL, domain, admin dashboard and retail pickup shop stay online while your subscription is active.',
  clientCommsDescription: `${CLIENT_COMMS_CLAIM} Included while your subscription is active.`,
};

const LANDING_COPY: RateCard1Copy = {
  ...DEFAULT_COPY,
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
};

const LANDING_LAYOUT: RateCard1LandingLayout = {
  eyebrow: 'SIMPLE PRICING',
  headingBeforePrice: 'Everything included for £',
  headingAfterPrice: '/month',
  lead: 'Your branded website, booking system, admin, deposits, retail and support — all in one monthly plan for one physical location.',
  planLabel: 'MONTHLY SUBSCRIPTION',
  planValueLine: 'Everything included. No setup fee.',
  trustPoints: [
    'One physical location',
    'Cancel anytime',
    'Your own domain included',
  ],
  ctaLabel: 'Start my KERSIVO subscription',
  checkoutNote: 'Secure checkout through Stripe',
  billingNote: BILLING_CYCLE_SHORT,
  includedHeading: 'WHAT’S INCLUDED',
  includedItems: [
    {
      heading: 'Branded website + your own domain',
      description: 'A professional website built around your barbershop and brand.',
      icon: 'globe',
    },
    {
      heading: 'Booking flow + admin dashboard',
      description: 'Manage bookings, clients and daily activity from one central system.',
      icon: 'dashboard',
    },
    {
      heading: 'Clients, deposits + reminders',
      description:
        'Keep client records, take optional deposits and send email confirmations and SMS appointment reminders.',
      icon: 'users',
    },
    {
      heading: 'Retail pickup + order management',
      description: 'Let clients order products online for collection in your shop.',
      icon: 'shoppingBag',
    },
    {
      heading: 'Barbers, services + working hours',
      description: 'Manage your team, prices, services and availability.',
      icon: 'scissors',
    },
    {
      heading: 'Reports, hosting + support',
      description:
        'Track performance while KERSIVO keeps the platform hosted, secure and maintained.',
      icon: 'chart',
    },
  ],
  supportItems: [
    'Migration help included',
    'Support inbox included',
    'Up to one hour of minor site changes each month',
    '0% KERSIVO commission',
  ],
  conditionsLine1: 'Standard Stripe payment-processing fees apply.',
  conditionsLine2:
    'Billed today, then monthly. Cancel anytime. KERSIVO is not currently VAT registered, so no VAT is added.',
};

export function getRateCard1Copy(variant: RateCard1Variant = 'default'): RateCard1Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}

export function getRateCard1LandingLayout(): RateCard1LandingLayout {
  return LANDING_LAYOUT;
}

export { SHARED as rateCard1SharedCopy };
