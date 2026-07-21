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

export function getRateCard1Copy(variant: RateCard1Variant = 'default'): RateCard1Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}

export { SHARED as rateCard1SharedCopy };
