import { offer } from '@/content/offer';
import {
  BILLING_CYCLE_SHORT,
  CLIENT_COMMS_CLAIM,
  DOMAIN_INCLUDED_SHORT,
  FREE_PREVIEW_BILLING_CLAIM,
  KERSIVO_COMMISSION_CLAIM,
  KERSIVO_COMMISSION_WITH_STRIPE,
  NO_SETUP_FEE_SHORT,
  PLAN_SCOPE_HIGHLIGHTS,
  PLAN_SCOPE_PILLS,
  PLAN_SCOPE_SHORT,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';

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
  /** Plain landing heading. When set, the price stays in the offer card. */
  heading?: string;
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
  /** Homepage-only contextual link below the landing pricing conditions. */
  calculatorLink: {
    before: string;
    label: string;
    href: string;
    after: string;
  };
};

const SHARED = {
  humansOnCallDescription:
    'Use the support inbox for day-to-day questions and help with straightforward website updates.',
  keepsScalingDescription:
    'We ship platform and security updates so the system stays maintained as your shop grows.',
} as const;

const PLAN_SUBTEXT = `${NO_SETUP_FEE_SHORT} ${PLAN_SCOPE_SHORT} ${DOMAIN_INCLUDED_SHORT} ${BILLING_CYCLE_SHORT} Cancel anytime.`;

const DEFAULT_COPY: RateCard1Copy = {
  ongoingCareBullets: [...PLAN_SCOPE_HIGHLIGHTS],
  planPills: [...PLAN_SCOPE_PILLS],
  planSubtext: PLAN_SUBTEXT,
  ctaLabel: offer.cta.subscribeDirect,
  leadCommissionLabel: KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''),
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_WITH_STRIPE}`,
  alwaysOnDescription:
    'Hosting, SSL, domain, admin dashboard and retail pickup shop stay online while your subscription is active.',
  clientCommsDescription: `${CLIENT_COMMS_CLAIM} Included while your subscription is active.`,
};

const LANDING_COPY: RateCard1Copy = {
  ...DEFAULT_COPY,
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_CLAIM}`,
};

const LANDING_LAYOUT: RateCard1LandingLayout = {
  eyebrow: 'BARBERSHOP SOFTWARE PRICING',
  heading: 'One price per shop. Every barber included.',
  headingBeforePrice: 'Barbershop software pricing: £',
  headingAfterPrice: '/month per location',
  lead: `Full KERSIVO is ${offer.price.full} per physical location — your branded website, own domain, booking system, payment control, clients, retail and support. Every barber at that location is included, subject to fair use. ${offer.fees.setup}, and no VAT added: ${offer.fees.vat}`,
  planLabel: offer.plans.full,
  planValueLine: 'Your branded website and wider business toolkit. No setup fee.',
  trustPoints: [
    'One physical location',
    'Cancel anytime',
    'Your own domain included',
  ],
  ctaLabel: offer.cta.subscribeDirect,
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
        'Keep client records and choose Pay at shop, a £5 deposit or full payment, with email confirmations, plus SMS appointment reminders within a monthly allowance.',
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
    'Website update support included',
    '0% KERSIVO commission on bookings and retail',
  ],
  conditionsLine1:
    `${STRIPE_FEES_NOTE} Your first payment is taken when you subscribe; your site is typically ready in a few days once we receive all required information.`,
  conditionsLine2: `Cancel anytime — Full KERSIVO stays active until the end of the paid month. ${offer.billing.refund}`,
  calculatorLink: {
    before: 'Comparing platforms? See the real cost of Booksy, Fresha and KERSIVO with our ',
    label: 'Barber Software Cost Calculator',
    href: '/barber-software-cost-calculator',
    after: '.',
  },
};

export function getRateCard1Copy(variant: RateCard1Variant = 'default'): RateCard1Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}

/** Pricing-card conditions while FREE_PREVIEW_FLOW_ENABLED is on (docs/free-preview-spec.md §10.3). */
const FREE_PREVIEW_LANDING_LAYOUT: RateCard1LandingLayout = {
  ...LANDING_LAYOUT,
  conditionsLine1: `${STRIPE_FEES_NOTE} ${FREE_PREVIEW_BILLING_CLAIM}`,
};

export function getRateCard1LandingLayout(freePreview = false): RateCard1LandingLayout {
  return freePreview ? FREE_PREVIEW_LANDING_LAYOUT : LANDING_LAYOUT;
}

export { SHARED as rateCard1SharedCopy };
