import { BOOKING_DEPOSIT_METADATA_TYPE } from '../booking/depositGate';
import { SHOP_ORDER_METADATA_TYPE } from './cardPaymentsGate';
import { retrieveCheckoutSession, type StripeSession } from './stripe';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getSecretKey(): string {
  const key = import.meta.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return key;
}

export class StripeConnectApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'StripeConnectApiError';
    this.status = status;
    this.code = code;
  }
}

function isMissingPaymentIntentError(error: unknown): boolean {
  if (!(error instanceof StripeConnectApiError)) return false;
  if (error.code === 'resource_missing') return true;
  const msg = error.message.toLowerCase();
  return msg.includes('no such payment_intent') || msg.includes('no such payment intent');
}

async function stripeForm(
  path: string,
  params: Record<string, string>,
  options?: { stripeAccount?: string; idempotencyKey?: string },
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (options?.stripeAccount) {
    headers['Stripe-Account'] = options.stripeAccount;
  }
  const idempotencyKey = options?.idempotencyKey?.trim();
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errObj =
      typeof json.error === 'object' && json.error ? (json.error as { message?: string; code?: string }) : null;
    const message = errObj?.message?.trim() || `Stripe error ${response.status}`;
    throw new StripeConnectApiError(message, response.status, errObj?.code?.trim() || null);
  }
  return json;
}

async function stripeGet(
  path: string,
  options?: { stripeAccount?: string },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getSecretKey()}`,
  };
  if (options?.stripeAccount) {
    headers['Stripe-Account'] = options.stripeAccount;
  }
  const response = await fetch(`${STRIPE_API_BASE}${path}`, { headers });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errObj =
      typeof json.error === 'object' && json.error ? (json.error as { message?: string; code?: string }) : null;
    const message = errObj?.message?.trim() || `Stripe GET failed (${response.status})`;
    throw new StripeConnectApiError(message, response.status, errObj?.code?.trim() || null);
  }
  return json;
}

export async function createConnectExpressAccount(input: {
  email?: string;
  shopId: string;
}): Promise<{ id: string }> {
  const params: Record<string, string> = {
    type: 'express',
    country: 'GB',
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    'metadata[shopId]': input.shopId,
    'metadata[kersivo]': 'booking_deposits',
  };
  if (input.email?.trim()) params.email = input.email.trim();
  const account = await stripeForm('/accounts', params);
  const id = typeof account.id === 'string' ? account.id : '';
  if (!id) throw new Error('Stripe Connect account id missing.');
  return { id };
}

export async function createConnectAccountLink(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const link = await stripeForm('/account_links', {
    account: input.accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: 'account_onboarding',
  });
  const url = typeof link.url === 'string' ? link.url : '';
  if (!url) throw new Error('Stripe Connect onboarding URL missing.');
  return { url };
}

export async function retrieveConnectAccount(accountId: string): Promise<{
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const account = await stripeGet(`/accounts/${encodeURIComponent(accountId)}`);
  return {
    chargesEnabled: Boolean(account.charges_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
  };
}

/**
 * Direct charge on the connected account (shop is MoR).
 * KERSIVO application fee is £0 today; hook kept for a future SaaS fee.
 */
export function bookingDepositCheckoutIdempotencyKey(bookingId: string): string {
  return `booking_deposit_checkout_${bookingId.trim()}`;
}

/** Stripe Checkout Session `expires_at` must be at least 30 minutes from creation. */
export const STRIPE_SESSION_MIN_TTL_MS = 30 * 60 * 1000;
/** Stripe Checkout Session `expires_at` max is 24 hours from creation. */
export const STRIPE_SESSION_MAX_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic session expiry anchored to booking.createdAt so the stable
 * Idempotency-Key (`booking_deposit_checkout_<id>`) always sees the same params.
 * Acts as a hard backstop (≥30m); the local hold may be shorter (typically 15m).
 */
export function resolveDepositSessionExpiresAt(input: {
  anchor: Date;
  holdExpiresAt?: Date | null;
}): Date {
  const anchorMs = input.anchor.getTime();
  if (!Number.isFinite(anchorMs)) {
    throw new Error('bookingCreatedAt must be a valid Date.');
  }
  const minBackstop = new Date(anchorMs + STRIPE_SESSION_MIN_TTL_MS);
  const maxBackstop = new Date(anchorMs + STRIPE_SESSION_MAX_TTL_MS);
  const hold = input.holdExpiresAt;
  const holdMs = hold instanceof Date ? hold.getTime() : NaN;
  const candidate =
    Number.isFinite(holdMs) && holdMs > minBackstop.getTime() ? new Date(holdMs) : minBackstop;
  return candidate.getTime() > maxBackstop.getTime() ? maxBackstop : candidate;
}

function isSessionAlreadyTerminalError(error: unknown): 'already_completed' | 'already_expired' | null {
  if (!(error instanceof StripeConnectApiError)) return null;
  const msg = error.message.toLowerCase();
  if (msg.includes('already been completed') || msg.includes('already complete')) {
    return 'already_completed';
  }
  if (msg.includes('already been expired') || msg.includes('already expired') || msg.includes('has expired')) {
    return 'already_expired';
  }
  // Stripe often returns resource_missing / invalid_request for terminal sessions.
  if (error.code === 'resource_missing' && msg.includes('checkout session')) {
    return 'already_expired';
  }
  return null;
}

export async function createBookingDepositCheckoutSession(input: {
  shopConnectAccountId: string;
  bookingId: string;
  shopId: string;
  customerEmail: string;
  shopName: string;
  /** Snapshot deposit in pence; must be > 0 (H04: min(service price, £5)). */
  amountPence: number;
  successUrl: string;
  cancelUrl: string;
  /** Booking.createdAt — anchors deterministic expires_at for Idempotency-Key stability. */
  bookingCreatedAt: Date;
  /** Local hold deadline; session backstop is at least 30 minutes from bookingCreatedAt. */
  holdExpiresAt?: Date | null;
}): Promise<{ id: string; url: string }> {
  const connectAccountId = input.shopConnectAccountId.trim();
  if (!connectAccountId) throw new Error('shopConnectAccountId is required for deposit checkout.');
  const amountPence = Math.trunc(input.amountPence);
  if (!Number.isFinite(amountPence) || amountPence <= 0) {
    throw new Error('amountPence must be a positive integer for deposit checkout.');
  }

  const expiresAt = resolveDepositSessionExpiresAt({
    anchor: input.bookingCreatedAt,
    holdExpiresAt: input.holdExpiresAt ?? null,
  });

  const session = await stripeForm(
    '/checkout/sessions',
    {
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'gbp',
      'line_items[0][price_data][unit_amount]': String(amountPence),
      'line_items[0][price_data][product_data][name]': `Booking deposit — ${input.shopName}`.slice(
        0,
        120,
      ),
      'line_items[0][quantity]': '1',
      expires_at: String(Math.floor(expiresAt.getTime() / 1000)),
      'metadata[type]': BOOKING_DEPOSIT_METADATA_TYPE,
      'metadata[bookingId]': input.bookingId,
      'metadata[shopId]': input.shopId,
      'payment_intent_data[application_fee_amount]': '0',
    },
    {
      stripeAccount: connectAccountId,
      idempotencyKey: bookingDepositCheckoutIdempotencyKey(input.bookingId),
    },
  );

  const id = typeof session.id === 'string' ? session.id : '';
  const url = typeof session.url === 'string' ? session.url : '';
  if (!id || !url) throw new Error('Stripe deposit session incomplete.');
  return { id, url };
}

export async function retrieveBookingDepositSession(
  sessionId: string,
  shopConnectAccountId: string,
): Promise<StripeSession> {
  return retrieveCheckoutSession(sessionId, { stripeAccount: shopConnectAccountId });
}

/**
 * Direct charge on the connected account for retail pickup orders (shop is MoR).
 * KERSIVO application fee is £0 today; hook kept for a future SaaS fee.
 */
export function retailCheckoutIdempotencyKey(orderId: string): string {
  return `shop_order_checkout_${orderId.trim()}`;
}

export type RetailCheckoutLineItem = {
  name: string;
  unitAmountPence: number;
  quantity: number;
  imageUrl?: string;
};

export async function createRetailCheckoutSession(input: {
  shopConnectAccountId: string;
  orderId: string;
  shopId: string;
  customerEmail?: string;
  lineItems: RetailCheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  /** Order.createdAt — anchors deterministic expires_at for Idempotency-Key stability. */
  orderCreatedAt: Date;
}): Promise<{ id: string; url: string }> {
  const connectAccountId = input.shopConnectAccountId.trim();
  if (!connectAccountId) throw new Error('shopConnectAccountId is required for retail checkout.');
  if (!input.lineItems.length) throw new Error('lineItems are required for retail checkout.');

  const expiresAt = resolveDepositSessionExpiresAt({
    anchor: input.orderCreatedAt,
    holdExpiresAt: null,
  });

  const params: Record<string, string> = {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    'payment_method_types[0]': 'card',
    expires_at: String(Math.floor(expiresAt.getTime() / 1000)),
    'metadata[type]': SHOP_ORDER_METADATA_TYPE,
    'metadata[orderId]': input.orderId,
    'metadata[shopId]': input.shopId,
    'payment_intent_data[application_fee_amount]': '0',
  };

  const customerEmail = input.customerEmail?.trim().toLowerCase();
  if (customerEmail) {
    params.customer_email = customerEmail;
  }

  input.lineItems.forEach((item, index) => {
    const unitAmount = Math.trunc(item.unitAmountPence);
    const quantity = Math.trunc(item.quantity);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      throw new Error(`lineItems[${index}].unitAmountPence must be a positive integer.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`lineItems[${index}].quantity must be a positive integer.`);
    }
    params[`line_items[${index}][price_data][currency]`] = 'gbp';
    params[`line_items[${index}][price_data][unit_amount]`] = String(unitAmount);
    params[`line_items[${index}][price_data][product_data][name]`] = item.name.slice(0, 120);
    params[`line_items[${index}][quantity]`] = String(quantity);
    const imageUrl = item.imageUrl?.trim();
    if (imageUrl) {
      params[`line_items[${index}][price_data][product_data][images][0]`] = imageUrl.slice(0, 2048);
    }
  });

  const session = await stripeForm('/checkout/sessions', params, {
    stripeAccount: connectAccountId,
    idempotencyKey: retailCheckoutIdempotencyKey(input.orderId),
  });

  const id = typeof session.id === 'string' ? session.id : '';
  const url = typeof session.url === 'string' ? session.url : '';
  if (!id || !url) throw new Error('Stripe retail session incomplete.');
  return { id, url };
}

export type ExpireSessionOutcome = 'expired' | 'already_completed' | 'already_expired';

/**
 * Actively invalidate an open Checkout Session on the connected account before
 * releasing a shorter local deposit hold. Maps terminal-session errors to outcomes
 * so the caller can re-fetch / recover without treating them as hard failures.
 */
export async function expireBookingDepositSession(
  sessionId: string,
  shopConnectAccountId: string,
): Promise<ExpireSessionOutcome> {
  const id = sessionId.trim();
  const connectAccountId = shopConnectAccountId.trim();
  if (!id) throw new Error('sessionId is required to expire a deposit checkout.');
  if (!connectAccountId) throw new Error('shopConnectAccountId is required to expire a deposit checkout.');

  try {
    const session = await stripeForm(
      `/checkout/sessions/${encodeURIComponent(id)}/expire`,
      {},
      {
        stripeAccount: connectAccountId,
        idempotencyKey: `booking_deposit_expire_${id}`,
      },
    );
    const status = typeof session.status === 'string' ? session.status.toLowerCase() : '';
    if (status === 'complete') return 'already_completed';
    if (status === 'expired') return 'expired';
    return 'expired';
  } catch (error) {
    const terminal = isSessionAlreadyTerminalError(error);
    if (terminal) return terminal;
    throw error;
  }
}

export type StripeRefundResult = {
  id: string;
  mode: 'direct' | 'platform_legacy';
  status: string;
  amount: number | null;
};

function parseRefundResult(
  refund: Record<string, unknown>,
  mode: 'direct' | 'platform_legacy',
): StripeRefundResult {
  const id = typeof refund.id === 'string' ? refund.id : '';
  if (!id) throw new Error('Stripe refund id missing.');
  const status = typeof refund.status === 'string' ? refund.status : 'succeeded';
  const amount =
    typeof refund.amount === 'number' && Number.isFinite(refund.amount)
      ? Math.trunc(refund.amount)
      : null;
  return { id, mode, status, amount };
}

export async function refundPaymentIntent(
  paymentIntentId: string,
  options?: {
    stripeAccount?: string;
    reverseTransfer?: boolean;
    amount?: number;
    /** Base key; `:direct` / `:legacy` suffixes are appended so paths stay distinct. */
    idempotencyKey?: string;
  },
): Promise<StripeRefundResult> {
  const params: Record<string, string> = {
    payment_intent: paymentIntentId,
  };
  if (typeof options?.amount === 'number' && Number.isFinite(options.amount) && options.amount > 0) {
    params.amount = String(Math.trunc(options.amount));
  }

  const baseKey = options?.idempotencyKey?.trim() || '';
  const connectAccountId = options?.stripeAccount?.trim();
  if (connectAccountId) {
    try {
      const refund = await stripeForm('/refunds', params, {
        stripeAccount: connectAccountId,
        idempotencyKey: baseKey ? `${baseKey}:direct` : undefined,
      });
      return parseRefundResult(refund, 'direct');
    } catch (error) {
      if (!isMissingPaymentIntentError(error)) throw error;
      // Legacy destination charges lived on the platform account.
    }
  }

  const legacyParams: Record<string, string> = {
    ...params,
    reverse_transfer: 'true',
  };
  if (options?.reverseTransfer === false) {
    delete legacyParams.reverse_transfer;
  }

  const refund = await stripeForm('/refunds', legacyParams, {
    idempotencyKey: baseKey ? `${baseKey}:legacy` : undefined,
  });
  return parseRefundResult(refund, 'platform_legacy');
}
