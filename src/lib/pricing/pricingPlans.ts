/**
 * /pricing plan cards, comparison table and billing row.
 * Cell values are taken from pricingPage / claimsPolicy / rateCard1Copy. Do not invent.
 */
import { BILLING_CYCLE_SHORT, KERSIVO_COMMISSION_CLAIM } from '@/lib/pricing/claimsPolicy';
import { getRateCard1LandingLayout } from '@/lib/pricing/rateCard1Copy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export type PlanCardFeature = {
  title: string;
  description: string;
};

export type PricingPlanVariant = 'full' | 'starter';

export type PricingPlanCardCopy = {
  variant: PricingPlanVariant;
  badge?: string;
  name: string;
  amount: number;
  qualifier: string;
  priceSize: 'md' | 'lg';
  description: string;
  features: readonly PlanCardFeature[];
  chips?: readonly string[];
  bestForTitle: string;
  bestFor: readonly string[];
  primaryCta: {
    label: string;
    href: string;
    track: string;
    placement: string;
  };
  secondaryCta: {
    label: string;
    href: string;
    track?: string;
    placement?: string;
  };
  checkoutNote?: string;
};

const fullLayout = getRateCard1LandingLayout();

export const PRICING_PLAN_LEAD =
  'Full KERSIVO for your own brand and website. Starter if you only need online bookings.';

/** Sourced from FREE_PREVIEW_NOT_A_TEMPLATE_CLAIM (“design each website individually”). */
export const PRICING_FULL_VALUE_STATEMENT =
  'Your branded website, own domain, booking system and shop tools — designed individually for your shop.';

export const PRICING_STARTER_DESCRIPTION =
  'A real booking system for one shop: hosted booking page, up to 4 active bookable barbers, Clients Core and email reminders. Public bookings use a £5 deposit or Pay in full through your connected Stripe account. 0% KERSIVO commission.';

export const PRICING_FULL_FEATURES: readonly PlanCardFeature[] = fullLayout.includedItems.map((item) => ({
  title: item.heading,
  description: item.description,
}));

/** Five Starter highlights, titles and lines taken from the Starter included list / card lead. */
export const PRICING_STARTER_FEATURES: readonly PlanCardFeature[] = [
  {
    title: 'KERSIVO-hosted booking page',
    description: 'A booking page hosted by KERSIVO for one shop.',
  },
  {
    title: 'Up to 4 bookable barbers',
    description: 'Up to 4 active bookable barbers at one location.',
  },
  {
    title: 'Clients Core',
    description: 'Keep client records in Clients Core.',
  },
  {
    title: 'Email confirmations and reminders',
    description: 'Automated email confirmations and reminders.',
  },
  {
    title: 'Public booking payments',
    description: '£5 deposit or Pay in full through your connected Stripe account.',
  },
];

export const PRICING_FULL_CHIPS = [
  'Migration help',
  'Support inbox',
  'Website update support',
  '0% KERSIVO commission',
] as const;

export const PRICING_FULL_BEST_FOR = [
  'you want your own website and domain',
  'you want Pay at shop or your own payment rules',
  'you have more than 4 barbers',
  'you want reports, retail pickup and SMS reminders',
] as const;

export const PRICING_STARTER_BEST_FOR = [
  'you want online booking now at no monthly cost',
  'you have up to 4 barbers',
  "you're happy for every online booking to be paid with a £5 deposit or in full through Stripe",
] as const;

export const PRICING_CHECKOUT_NOTE = fullLayout.checkoutNote;

export const PRICING_PLAN_CARDS: Record<PricingPlanVariant, PricingPlanCardCopy> = {
  full: {
    variant: 'full',
    badge: 'Recommended for your own brand',
    name: 'Full KERSIVO',
    amount: SAAS_MONTHLY_GBP,
    qualifier: 'per location · no setup fee',
    priceSize: 'lg',
    description: PRICING_FULL_VALUE_STATEMENT,
    features: PRICING_FULL_FEATURES,
    chips: PRICING_FULL_CHIPS,
    bestForTitle: 'Best for',
    bestFor: PRICING_FULL_BEST_FOR,
    primaryCta: {
      label: `Start Full KERSIVO — £${SAAS_MONTHLY_GBP}/month`,
      href: '/admin/launch',
      track: 'saas_subscribe_click',
      placement: 'pricing_plans',
    },
    secondaryCta: {
      label: `Or subscribe now — £${SAAS_MONTHLY_GBP}/month`,
      href: '/admin/launch',
      track: 'saas_subscribe_click',
      placement: 'pricing_plans',
    },
    checkoutNote: PRICING_CHECKOUT_NOTE,
  },
  starter: {
    variant: 'starter',
    name: 'KERSIVO Starter',
    amount: 0,
    qualifier: 'up to 4 barbers · one location',
    priceSize: 'md',
    description: PRICING_STARTER_DESCRIPTION,
    features: PRICING_STARTER_FEATURES,
    bestForTitle: 'Best for',
    bestFor: PRICING_STARTER_BEST_FOR,
    primaryCta: {
      label: 'Start KERSIVO Starter',
      href: '/admin',
      track: 'starter_signup_click',
      placement: 'pricing_plans',
    },
    secondaryCta: {
      label: 'What’s in KERSIVO Starter →',
      href: '/starter',
    },
  },
};

export const PRICING_REFUND_SENTENCE = `If we're unable to deliver your Full KERSIVO service due to a failure on our side, we'll refund your initial £${SAAS_MONTHLY_GBP} subscription payment.`;

export const PRICING_BILLING_COLUMNS = [
  {
    id: 'billing',
    title: 'Billing',
    icon: 'billing' as const,
    body: `${BILLING_CYCLE_SHORT} Cancel anytime.`,
  },
  {
    id: 'fees',
    title: 'Fees',
    icon: 'fees' as const,
    body: `${KERSIVO_COMMISSION_CLAIM} Standard Stripe payment-processing fees apply to online payments.`,
  },
  {
    id: 'refund',
    title: 'Guarantee',
    icon: 'refund' as const,
    body: PRICING_REFUND_SENTENCE,
  },
] as const;

export type CompareCell =
  | { kind: 'included' }
  | { kind: 'excluded' }
  | { kind: 'text'; value: string };

export type CompareRow = {
  feature: string;
  help?: string;
  starter: CompareCell;
  full: CompareCell;
  /**
   * Founder must confirm this side before the row can render.
   * 'starter' | 'full' names the unconfirmed cell.
   */
  pendingConfirmation?: 'starter' | 'full';
};

export type CompareGroup = {
  id: string;
  title: string;
  /** Collapse this group behind “Show all features” on small screens. */
  collapseOnMobile?: boolean;
  rows: readonly CompareRow[];
};

const included: CompareCell = { kind: 'included' };
const excluded: CompareCell = { kind: 'excluded' };

export const PRICING_COMPARE_CAPTION =
  'Feature comparison of KERSIVO Starter (£0/month) and Full KERSIVO (£39/month).';

export const PRICING_COMPARE_GROUPS: readonly CompareGroup[] = [
  {
    id: 'website-brand',
    title: 'Website & brand',
    rows: [
      {
        feature: 'Branded barbershop website',
        starter: excluded,
        full: included,
      },
      {
        feature: 'Own domain included',
        starter: excluded,
        full: included,
      },
      {
        feature: 'Booking page',
        starter: { kind: 'text', value: 'KERSIVO-hosted booking page' },
        full: { kind: 'text', value: 'On your own website' },
      },
      {
        feature: 'Hosting, SSL and platform updates',
        starter: excluded,
        full: included,
        // TODO(founder): confirm Starter value. Full is listed in PRICING_INCLUDED_GROUPS.
        // Do not render this row until confirmed.
        pendingConfirmation: 'starter',
      },
    ],
  },
  {
    id: 'bookings-payments',
    title: 'Bookings & payments',
    rows: [
      {
        feature: 'Online and manual bookings',
        starter: included,
        full: included,
      },
      {
        feature: 'Bookable barbers',
        starter: { kind: 'text', value: 'Up to 4' },
        full: { kind: 'text', value: 'More than 4, fair use' },
      },
      {
        feature: 'Payment options at booking',
        starter: { kind: 'text', value: '£5 deposit or Pay in full' },
        full: {
          kind: 'text',
          value: 'Pay at shop, £5 deposit or full payment — editable',
        },
      },
      {
        feature: 'Email confirmations and reminders',
        starter: included,
        full: included,
      },
      {
        feature: 'SMS appointment reminders',
        starter: excluded,
        full: { kind: 'text', value: 'Included within monthly allowance' },
      },
      {
        feature: 'Booking history',
        starter: { kind: 'text', value: 'Rolling 90 days' },
        full: { kind: 'text', value: 'Full history' },
      },
    ],
  },
  {
    id: 'clients-business',
    title: 'Clients & business',
    collapseOnMobile: true,
    rows: [
      {
        feature: 'Client records',
        starter: { kind: 'text', value: 'Clients Core' },
        full: { kind: 'text', value: 'Advanced Clients / CRM' },
      },
      {
        feature: 'Reports',
        starter: excluded,
        full: included,
      },
      {
        feature: 'Retail pickup shop',
        starter: excluded,
        full: included,
      },
      {
        feature: 'KERSIVO Assistant',
        help: 'AI guidance on using KERSIVO and running your shop.',
        starter: excluded,
        full: included,
      },
    ],
  },
  {
    id: 'setup-support',
    title: 'Setup & support',
    collapseOnMobile: true,
    rows: [
      {
        feature: 'Google Business Profile booking-link setup',
        starter: { kind: 'text', value: 'Guided' },
        full: included,
      },
      {
        feature: 'Initial QR Kit for an eligible verified UK location',
        starter: included,
        full: included,
      },
      {
        feature: 'Migration from your current system',
        starter: excluded,
        full: included,
      },
      {
        feature: 'Website update support',
        starter: excluded,
        full: included,
      },
    ],
  },
  {
    id: 'fees',
    title: 'Fees',
    collapseOnMobile: true,
    rows: [
      {
        feature: 'Monthly price',
        starter: { kind: 'text', value: '£0' },
        full: { kind: 'text', value: `£${SAAS_MONTHLY_GBP} per location` },
      },
      {
        feature: 'Setup fee',
        starter: { kind: 'text', value: 'None' },
        full: { kind: 'text', value: 'None' },
      },
      {
        feature: 'KERSIVO commission',
        starter: { kind: 'text', value: '0%' },
        full: { kind: 'text', value: '0%' },
      },
      {
        feature: 'Stripe payment-processing fees',
        starter: { kind: 'text', value: 'Apply' },
        full: { kind: 'text', value: 'Apply' },
      },
      {
        feature: 'Stripe account',
        starter: { kind: 'text', value: 'Required before public bookings go live' },
        full: excluded,
        // TODO(founder): confirm Full value. Starter is listed in PRICING_INCLUDED_GROUPS.
        // Do not render this row until confirmed.
        pendingConfirmation: 'full',
      },
    ],
  },
];

export function getRenderableCompareGroups(): CompareGroup[] {
  return PRICING_COMPARE_GROUPS.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !row.pendingConfirmation),
  })).filter((group) => group.rows.length > 0);
}

export function getPendingCompareRows(): CompareRow[] {
  return PRICING_COMPARE_GROUPS.flatMap((group) => group.rows.filter((row) => row.pendingConfirmation));
}

export function compareCellText(cell: CompareCell): string {
  if (cell.kind === 'included') return 'Included';
  if (cell.kind === 'excluded') return 'Not included';
  return cell.value;
}
