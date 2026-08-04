import crypto from 'node:crypto';

type StripeCheckoutParams = {
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Array<{ productId: string; name: string; unitAmount: number; quantity: number; imageUrl?: string }>;
  metadata: Record<string, string>;
};

type StripeSubscriptionCheckoutParams = {
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  productId: string;
  name: string;
  unitAmount: number;
  metadata: Record<string, string>;
  /** Stable Stripe Idempotency-Key; must not change across retries of the same attempt. */
  idempotencyKey?: string;
};

export type StripeSession = {
  id: string;
  url?: string;
  /** Checkout Session lifecycle: open | complete | expired. */
  status?: string | null;
  amount_total: number | null;
  currency: string | null;
  payment_status?: string | null;
  customer?: string | { id?: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  payment_intent?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  metadata?: Record<string, string>;
};

export type StripeSubscription = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  /** Removed from the subscription root in API 2025-03-31.basil; kept for older payloads. */
  current_period_end?: number | null;
  /** Basil and later expose the billing period per subscription item. */
  items?: { data?: Array<{ current_period_end?: number | null }> } | null;
  canceled_at?: number | null;
  customer?: string | { id?: string } | null;
  metadata?: Record<string, string>;
};

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getSecretKey(): string {
  const key = import.meta.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return key;
}

export async function createCheckoutSession(params: StripeCheckoutParams): Promise<{ id: string; url: string }> {
  const secretKey = getSecretKey();
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', params.successUrl);
  body.set('cancel_url', params.cancelUrl);
  const customerEmail = params.customerEmail?.trim();
  if (customerEmail) {
    body.set('customer_email', customerEmail);
  }

  params.lineItems.forEach((item, index) => {
    body.set(`line_items[${index}][price_data][currency]`, 'gbp');
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    body.set(`line_items[${index}][price_data][product_data][metadata][productId]`, item.productId);
    if (item.imageUrl) {
     body.set(`line_items[${index}][price_data][product_data][images][0]`, item.imageUrl);
    }
 
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
  });

  Object.entries(params.metadata).forEach(([key, value]) => {
    body.set(`metadata[${key}]`, value);
  });

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe checkout failed (${response.status}): ${text}`);
  }

  const session = (await response.json()) as StripeSession;
  if (!session.url) throw new Error('Stripe did not return checkout URL.');

  return { id: session.id, url: session.url };
}

export async function createSubscriptionCheckoutSession(
  params: StripeSubscriptionCheckoutParams,
): Promise<{ id: string; url: string }> {
  const secretKey = getSecretKey();
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', params.successUrl);
  body.set('cancel_url', params.cancelUrl);
  body.set('payment_method_types[0]', 'card');
  const customerEmail = params.customerEmail?.trim();
  if (customerEmail) {
    body.set('customer_email', customerEmail);
  }

  body.set('line_items[0][price_data][currency]', 'gbp');
  body.set('line_items[0][price_data][unit_amount]', String(params.unitAmount));
  body.set('line_items[0][price_data][recurring][interval]', 'month');
  body.set('line_items[0][price_data][product_data][name]', params.name);
  body.set('line_items[0][price_data][product_data][metadata][productId]', params.productId);
  body.set('line_items[0][quantity]', '1');

  Object.entries(params.metadata).forEach(([key, value]) => {
    body.set(`metadata[${key}]`, value);
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const idempotencyKey = params.idempotencyKey?.trim();
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe subscription checkout failed (${response.status}): ${text}`);
  }

  const session = (await response.json()) as StripeSession;
  if (!session.url) throw new Error('Stripe did not return checkout URL.');

  return { id: session.id, url: session.url };
}

export async function retrieveCheckoutSession(
  sessionId: string,
  options?: { stripeAccount?: string },
): Promise<StripeSession> {
  const secretKey = getSecretKey();
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` };
  const stripeAccount = options?.stripeAccount?.trim();
  if (stripeAccount) {
    headers['Stripe-Account'] = stripeAccount;
  }

  const response = await fetch(
    `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product`,
    { headers },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe session lookup failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StripeSession;
}

export function getCheckoutPaymentIntentId(session: StripeSession): string | null {
  const pi = session.payment_intent;
  if (typeof pi === 'string' && pi.trim()) return pi.trim();
  if (pi && typeof pi === 'object' && typeof pi.id === 'string' && pi.id.trim()) return pi.id.trim();
  return null;
}

export function getCheckoutSubscriptionId(session: StripeSession): string | null {
  const sub = session.subscription;
  if (typeof sub === 'string' && sub.trim()) return sub.trim();
  if (sub && typeof sub === 'object' && typeof sub.id === 'string' && sub.id.trim()) return sub.id.trim();
  return null;
}

export function getCheckoutCustomerId(session: StripeSession): string | null {
  const customer = session.customer;
  if (typeof customer === 'string' && customer.trim()) return customer.trim();
  if (customer && typeof customer === 'object' && typeof customer.id === 'string' && customer.id.trim()) {
    return customer.id.trim();
  }
  return null;
}

export function getStripeCustomerId(
  customer: string | { id?: string } | null | undefined,
): string | null {
  if (typeof customer === 'string' && customer.trim()) return customer.trim();
  if (customer && typeof customer === 'object' && typeof customer.id === 'string' && customer.id.trim()) {
    return customer.id.trim();
  }
  return null;
}

/**
 * Billing period end in unix seconds, tolerating both payload shapes.
 * API 2025-03-31.basil moved `current_period_end` from the subscription root onto its items.
 * Takes the latest item period so entitlement is never cut short on multi-item subscriptions.
 */
export function getSubscriptionCurrentPeriodEnd(
  subscription: Pick<StripeSubscription, 'current_period_end' | 'items'>,
): number | null {
  const root = subscription.current_period_end;
  if (typeof root === 'number' && Number.isFinite(root)) return root;

  const itemEnds = (subscription.items?.data ?? [])
    .map((item) => item?.current_period_end)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return itemEnds.length ? Math.max(...itemEnds) : null;
}

export async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  const secretKey = getSecretKey();
  const response = await fetch(
    `${STRIPE_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe subscription lookup failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StripeSubscription;
}

/** Schedule cancel at period end. Local DB must be synced only after this succeeds. */
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
): Promise<StripeSubscription> {
  const secretKey = getSecretKey();
  const body = new URLSearchParams();
  body.set('cancel_at_period_end', 'true');

  const response = await fetch(
    `${STRIPE_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe subscription cancel failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StripeSubscription;
}

/**
 * Stripe Customer Portal session for cancel-at-period-end, payment method, and invoices.
 * Requires Customer Portal to be enabled in the Stripe Dashboard (Settings → Billing → Customer portal).
 */
export async function createBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<{ id: string; url: string }> {
  const secretKey = getSecretKey();
  const body = new URLSearchParams();
  body.set('customer', input.customerId);
  body.set('return_url', input.returnUrl);

  const response = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe billing portal session failed (${response.status}): ${text}`);
  }

  const session = (await response.json()) as { id?: string; url?: string };
  if (!session.url || !session.id) throw new Error('Stripe did not return a billing portal URL.');
  return { id: session.id, url: session.url };
}

/** Stripe default webhook signature timestamp tolerance (seconds). */
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'malformed_header' | 'timestamp_out_of_tolerance' | 'signature_mismatch' };

function parseStripeSignatureHeader(signatureHeader: string): {
  timestamp: string | null;
  signatures: string[];
} {
  const elements = signatureHeader.split(',').map((part) => part.trim()).filter(Boolean);
  const timestamp = elements.find((part) => part.startsWith('t='))?.slice(2) ?? null;
  const signatures = elements
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return { timestamp, signatures };
}

function signatureMatches(signedPayload: string, signature: string, webhookSecret: string): boolean {
  const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Accepts platform webhook secret and optional Connect (connected-accounts) secret.
 * Direct-charge deposit events arrive on the Connect endpoint.
 * Rejects timestamps outside ±tolerance (default 300s) to block indefinite replay.
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  options: { nowMs?: number; toleranceSeconds?: number } = {},
): WebhookVerifyResult {
  const platformSecret = (
    import.meta.env.STRIPE_WEBHOOK_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET ??
    ''
  )
    .toString()
    .trim();
  const connectSecret = (
    import.meta.env.STRIPE_CONNECT_WEBHOOK_SECRET ??
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET ??
    ''
  )
    .toString()
    .trim();

  if (!platformSecret && !connectSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: 'malformed_header' };
  }

  const timestampSec = Number(timestamp);
  if (!Number.isFinite(timestampSec)) {
    return { ok: false, reason: 'malformed_header' };
  }

  const nowMs = options.nowMs ?? Date.now();
  const tolerance = options.toleranceSeconds ?? STRIPE_WEBHOOK_TOLERANCE_SECONDS;
  const ageSeconds = Math.abs(nowMs / 1000 - timestampSec);
  if (ageSeconds > tolerance) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const signedPayload = `${timestamp}.${payload}`;
  const secrets = [platformSecret, connectSecret].filter(Boolean);
  for (const secret of secrets) {
    for (const signature of signatures) {
      if (signatureMatches(signedPayload, signature, secret)) {
        return { ok: true };
      }
    }
  }

  return { ok: false, reason: 'signature_mismatch' };
}
