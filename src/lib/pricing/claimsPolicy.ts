/**
 * Shared public-facing pricing / commission claim policy.
 * Keep marketing, FAQ and Terms aligned with what the product actually delivers.
 */

export const PRICE_VAT_DISCLAIMER =
  'Prices shown are final. KERSIVO is not currently VAT registered, so no VAT is added.';

/** Preferred short commission framing. */
export const KERSIVO_COMMISSION_CLAIM = '0% KERSIVO commission.';

/** Stripe qualification — use near commission claims. */
export const STRIPE_FEES_NOTE = 'Standard Stripe payment-processing fees still apply.';

export const KERSIVO_COMMISSION_WITH_STRIPE = `${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`;

/**
 * Care includes transactional email reminders today.
 * Automated SMS is not a live platform feature yet — do not claim "unlimited SMS".
 */
export const EMAIL_REMINDERS_CLAIM = 'Email appointment confirmations and reminders';

/** @deprecated Prefer EMAIL_REMINDERS_CLAIM — kept as alias for gradual migration. */
export const SMS_INCLUDED_CLAIM = EMAIL_REMINDERS_CLAIM;

export const SMS_ROADMAP_NOTE =
  'Automated SMS reminders are not yet enabled in the live platform; ask at setup if SMS is required for your launch.';

export const STRIPE_ACCOUNT_CLAIM =
  'The public retail demo is a simulation (no Stripe payment). Private owner test orders create marked test data without payment. Live shops connect to your Stripe account during go-live setup.';
