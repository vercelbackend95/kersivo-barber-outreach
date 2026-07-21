import {
  KERSIVO_COMMISSION_CLAIM,
  SMS_INCLUDED_CLAIM,
  STRIPE_FEES_NOTE,
} from '@/lib/pricing/claimsPolicy';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export type RateCard1Variant = 'default' | 'landing';

export type RateCard1Copy = {
  ongoingCareBullets: string[];
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

const SAAS_BULLETS_DEFAULT = [
  'Custom site + booking + admin + pickup shop setup',
  'Domain purchase, management and renewal while your subscription is active',
  `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  'Hosting + SSL included while your subscription is active',
  `${SMS_INCLUDED_CLAIM}. Support, platform updates, 1h minor changes/month`,
];

const SAAS_BULLETS_LANDING = [
  'Custom site + booking + admin + pickup shop setup',
  'Domain purchase, management and renewal while your subscription is active',
  `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  'Hosting + SSL included while your subscription is active',
  `${SMS_INCLUDED_CLAIM}. Support, platform updates, and 1 hour of minor changes each month`,
];

const DEFAULT_COPY: RateCard1Copy = {
  ongoingCareBullets: SAAS_BULLETS_DEFAULT,
  planSubtext:
    'Everything you need to run booking, retail and admin on your own domain — billed monthly, cancel anytime.',
  ctaLabel: `Get started — £${SAAS_MONTHLY_GBP}/mo`,
  leadCommissionLabel: KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''),
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  alwaysOnDescription:
    'Hosting, SSL, domain renewal, admin panel and pickup shop stay online while your subscription is active.',
  clientCommsDescription: `${SMS_INCLUDED_CLAIM} while your subscription is active.`,
};

const LANDING_COPY: RateCard1Copy = {
  ongoingCareBullets: SAAS_BULLETS_LANDING,
  planSubtext:
    'Everything you need to run booking, retail and admin on your own domain — billed monthly, cancel anytime.',
  ctaLabel: `Get started — £${SAAS_MONTHLY_GBP}/mo`,
  leadCommissionLabel: KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''),
  bookingShopDescription: `Clients book and buy on your domain. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
  alwaysOnDescription:
    'Hosting, SSL, domain renewal, admin panel and pickup shop stay online while your subscription is active.',
  clientCommsDescription: `${SMS_INCLUDED_CLAIM} while your subscription is active.`,
};

export function getRateCard1Copy(variant: RateCard1Variant = 'default'): RateCard1Copy {
  return variant === 'landing' ? LANDING_COPY : DEFAULT_COPY;
}

export { SHARED as rateCard1SharedCopy };
