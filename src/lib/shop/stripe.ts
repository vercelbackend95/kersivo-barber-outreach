import crypto from 'node:crypto';

type StripeCheckoutParams = {
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Array<{ productId: string; name: string; unitAmount: number; quantity: number; imageUrl?: string }>;
  metadata: Record<string, string>;
};

type StripeSession = {
  id: string;
  url: string;
  amount_total: number | null;
  currency: string | null;
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
  body.set('customer_email', params.customerEmail);

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

export async function retrieveCheckoutSession(sessionId: string): Promise<StripeSession> {
  const secretKey = getSecretKey();
  const response = await fetch(
    `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product`,
    {
      headers: { Authorization: `Bearer ${secretKey}` }
    }
  );


  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe session lookup failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StripeSession;
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string): boolean {
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');

  const elements = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = elements.find((part) => part.startsWith('t='))?.slice(2);
  const signature = elements.find((part) => part.startsWith('v1='))?.slice(3);

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
