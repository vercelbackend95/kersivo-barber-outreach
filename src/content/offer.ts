/**
 * Canonical public commercial strings for KERSIVO marketing.
 * Import these instead of hard-coding prices, fees, billing or CTA labels.
 * Legal meaning is unchanged from claimsPolicy / the live site; this file is the
 * single source of truth for the wording that appears on marketing pages.
 */
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

export const offer = {
  plans: {
    full: 'Full KERSIVO',
    starter: 'KERSIVO Starter',
  },
  price: {
    full: `£${SAAS_MONTHLY_GBP}/month`,
    fullQualifier: 'per location',
    starter: '£0/month',
    amount: SAAS_MONTHLY_GBP,
  },
  fees: {
    stripe: 'Standard Stripe payment-processing fees apply to online payments.',
    commission: '0% KERSIVO commission',
    setup: 'No setup fee',
    vat: 'KERSIVO is not currently VAT registered, so no VAT is added.',
  },
  billing: {
    cycle: 'Billed today, then monthly on the same day. Cancel anytime.',
    cycleShort: 'Billed today, then monthly on the same day.',
    refund: `If we're unable to deliver your Full KERSIVO service due to a failure on our side, we'll refund your initial £${SAAS_MONTHLY_GBP} subscription payment.`,
  },
  cta: {
    primary: 'Get my free preview',
    subscribe: `Or subscribe now — £${SAAS_MONTHLY_GBP}/month`,
    subscribeDirect: `Start Full KERSIVO — £${SAAS_MONTHLY_GBP}/month`,
  },
  demo: {
    fictional: 'CUTSTATE is a fictional demonstration shop.',
  },
} as const;

export type OfferCopy = typeof offer;
