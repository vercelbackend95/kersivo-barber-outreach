import { BOOKING_DEPOSIT_METADATA_TYPE, BOOKING_DEPOSIT_PENCE } from '../booking/depositGate';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getSecretKey(): string {
  const key = import.meta.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return key;
}

async function stripeForm(
  path: string,
  params: Record<string, string>,
  options?: { stripeAccount?: string },
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (options?.stripeAccount) {
    headers['Stripe-Account'] = options.stripeAccount;
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof json.error === 'object' && json.error && 'message' in json.error
        ? String((json.error as { message?: string }).message)
        : `Stripe error ${response.status}`;
    throw new Error(message);
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
    throw new Error(`Stripe GET failed (${response.status})`);
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

export async function createBookingDepositCheckoutSession(input: {
  shopConnectAccountId: string;
  bookingId: string;
  shopId: string;
  customerEmail: string;
  shopName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', input.successUrl);
  body.set('cancel_url', input.cancelUrl);
  body.set('customer_email', input.customerEmail);
  body.set('payment_method_types[0]', 'card');
  body.set('line_items[0][price_data][currency]', 'gbp');
  body.set('line_items[0][price_data][unit_amount]', String(BOOKING_DEPOSIT_PENCE));
  body.set(
    'line_items[0][price_data][product_data][name]',
    `Booking deposit — ${input.shopName}`.slice(0, 120),
  );
  body.set('line_items[0][quantity]', '1');
  body.set(`metadata[type]`, BOOKING_DEPOSIT_METADATA_TYPE);
  body.set(`metadata[bookingId]`, input.bookingId);
  body.set(`metadata[shopId]`, input.shopId);
  // Direct charge on connected account (shop receives funds; KERSIVO takes 0%).
  body.set('payment_intent_data[application_fee_amount]', '0');
  body.set('payment_intent_data[transfer_data][destination]', input.shopConnectAccountId);

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const session = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(session.error?.message || `Deposit checkout failed (${response.status})`);
  }
  if (!session.id || !session.url) throw new Error('Stripe deposit session incomplete.');
  return { id: session.id, url: session.url };
}

export async function refundPaymentIntent(
  paymentIntentId: string,
  options?: { stripeAccount?: string },
): Promise<{ id: string }> {
  const refund = await stripeForm(
    '/refunds',
    { payment_intent: paymentIntentId },
    options?.stripeAccount ? { stripeAccount: options.stripeAccount } : undefined,
  );
  const id = typeof refund.id === 'string' ? refund.id : '';
  if (!id) throw new Error('Stripe refund id missing.');
  return { id };
}
