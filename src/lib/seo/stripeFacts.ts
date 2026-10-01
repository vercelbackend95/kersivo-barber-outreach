/**
 * Static Stripe UK card processing facts used for KERSIVO booking deposits (Stripe Checkout).
 * Checked against the official Stripe UK pricing page only — never fetched at runtime.
 * Client-safe: no Stripe SDK, keys or server modules.
 */

export const STRIPE_FACTS_CHECKED_DATE = '1 October 2026';
export const STRIPE_FACTS_CHECKED_ISO = '2026-10-01';

export const STRIPE_SOURCE_UK_PRICING = 'https://stripe.com/gb/pricing';

/** Standard UK card rate. Checkout adds no separate fee. */
export const STRIPE_UK_STANDARD_CARD_PERCENT = 1.5;
export const STRIPE_UK_STANDARD_CARD_FIXED_GBP = 0.2;

/** Stripe does not charge UK VAT on its processing fees for this model. Not tax advice. */
export const STRIPE_FEE_VAT_CHARGED = false;

/** KERSIVO takes no application fee on deposits. */
export const KERSIVO_DEPOSIT_APPLICATION_FEE_GBP = 0;

export const STRIPE_CARD_ASSUMPTION = 'standard-uk-card' as const;

/** Expected from the direct-charge Connect setup; not yet confirmed on a live connected account. */
export const STRIPE_FEE_PAYER_CAVEAT =
  'The KERSIVO estimate assumes Stripe processing fees are charged to the connected barbershop account. Confirm this against your live Stripe Connect setup before relying on it for a specific account.';

export const STRIPE_CARD_CAVEAT =
  'The KERSIVO estimate assumes a standard UK card. Premium UK and international cards can have higher Stripe processing fees.';
