/**
 * Shared public-facing pricing / commission claim policy.
 * Confirmed commercial rules — keep marketing, FAQ and Terms aligned.
 */

export const PRICE_VAT_DISCLAIMER =
  'Prices shown are final. KERSIVO is not currently VAT registered, so no VAT is added.';

/** Preferred short commission framing. */
export const KERSIVO_COMMISSION_CLAIM = '0% KERSIVO commission.';

/** Stripe qualification — use near commission claims. */
export const STRIPE_FEES_NOTE = 'Standard Stripe payment-processing fees still apply.';

export const KERSIVO_COMMISSION_WITH_STRIPE = `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`;

export const SMS_INCLUDED_CLAIM = 'SMS reminders';
