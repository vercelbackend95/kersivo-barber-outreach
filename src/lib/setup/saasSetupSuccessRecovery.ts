/**
 * Post-purchase recovery entry for the £39 SaaS journey.
 * session_id is an identifier only — entitlement is proven by claim + Stripe.
 */

const STRIPE_CHECKOUT_SESSION_ID_RE = /^cs_[A-Za-z0-9_]+$/;

export function isStripeCheckoutSessionId(value: string): boolean {
  return STRIPE_CHECKOUT_SESSION_ID_RE.test(value.trim());
}

/** Relative Better Auth callbackURL — never an open redirect. */
export function buildSetupSuccessCallbackUrl(stripeSessionId: string): string {
  const id = stripeSessionId.trim();
  if (!isStripeCheckoutSessionId(id)) {
    return '/setup/success';
  }
  return `/setup/success?session_id=${encodeURIComponent(id)}`;
}

export function buildSetupSuccessRecoveryUrl(publicSiteUrl: string, stripeSessionId: string): string {
  const base = publicSiteUrl.replace(/\/$/, '');
  const id = stripeSessionId.trim();
  if (!isStripeCheckoutSessionId(id)) {
    return `${base}/setup/success`;
  }
  return `${base}/setup/success?session_id=${encodeURIComponent(id)}`;
}

export type ClaimUxState =
  | { kind: 'idle' }
  | { kind: 'claiming' }
  | { kind: 'need_auth' }
  | { kind: 'error'; message: string; retryable: boolean };

export function mapClaimHttpError(status: number, code?: string | null): ClaimUxState {
  if (status === 401) {
    return { kind: 'need_auth' };
  }
  if (status === 403 && code === 'EMAIL_MISMATCH') {
    return {
      kind: 'error',
      message: 'Please sign in with the same email address you used when purchasing KERSIVO.',
      retryable: true,
    };
  }
  if (status === 403) {
    return {
      kind: 'error',
      message:
        'We could not confirm an active subscription for this purchase. Please try again or contact hello@kersivo.co.uk.',
      retryable: true,
    };
  }
  if (status === 404) {
    return {
      kind: 'error',
      message:
        'We could not find this subscription yet. Please try again in a moment or contact hello@kersivo.co.uk.',
      retryable: true,
    };
  }
  if (status === 409 && code === 'ALREADY_OWNED') {
    return {
      kind: 'error',
      message:
        'This subscription is already linked to another KERSIVO account. Contact hello@kersivo.co.uk for help.',
      retryable: false,
    };
  }
  if (status === 409 && code === 'CLAIM_RACE') {
    return {
      kind: 'error',
      message: 'Another setup step was still finishing. Please try again.',
      retryable: true,
    };
  }
  if (status === 502 || status === 503) {
    return {
      kind: 'error',
      message: 'Something went wrong on our side. Please try again or contact hello@kersivo.co.uk.',
      retryable: true,
    };
  }
  return {
    kind: 'error',
    message: 'We could not continue your setup. Please try again or contact hello@kersivo.co.uk.',
    retryable: true,
  };
}
