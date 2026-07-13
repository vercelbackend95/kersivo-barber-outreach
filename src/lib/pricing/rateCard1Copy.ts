import { KERSIVO_COMMISSION_CLAIM, SMS_INCLUDED_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';

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
    'Support inbox for day-to-day questions, plus up to one hour of minor development changes each month.',
  keepsScalingDescription:
    'We ship platform and security updates so the system stays maintained as your shop grows.',
} as const;

const DEFAULT_COPY: RateCard1Copy = {
  ongoingCareBullets: [
    `Online booking — ${KERSIVO_COMMISSION_CLAIM}`,
    `Retail pickup shop — ${KERSIVO_COMMISSION_CLAIM}`,
    SMS_INCLUDED_CLAIM,
    'Hosting, SSL, domain renewal',
    'Transactional emails',
    'Support + up to 1 hour of minor changes/month',
    'Platform and security updates',
  ],
  leadCommissionLabel: KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''),
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  alwaysOnDescription:
    'Hosting, SSL, domain renewal, admin panel and pickup shop stay online while Care is active.',
  clientCommsDescription: `${SMS_INCLUDED_CLAIM}. Transactional emails are included while Care is active.`,
};

const LANDING_COPY: RateCard1Copy = {
  ongoingCareBullets: [
    `Online booking — ${KERSIVO_COMMISSION_CLAIM}`,
    `Retail pickup shop — ${KERSIVO_COMMISSION_CLAIM}`,
    SMS_INCLUDED_CLAIM,
    'Hosting, SSL, domain renewal',
    'Transactional emails',
    'Support + up to 1 hour of minor changes each month',
    'Platform and security updates',
  ],
  leadCommissionLabel: KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''),
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  alwaysOnDescription:
    'Hosting, SSL, domain renewal, admin panel and pickup shop stay online while Care is active.',
  clientCommsDescription: `${SMS_INCLUDED_CLAIM}. Transactional emails are included while Care is active.`,
};

export function getRateCard1Copy(variant: RateCard1Variant = 'default'): RateCard1Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}

export { SHARED as rateCard1SharedCopy };
