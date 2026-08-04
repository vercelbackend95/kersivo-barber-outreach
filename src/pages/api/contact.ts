export const prerender = false;

import type { APIRoute } from 'astro';
import { EmailDeliveryError, sendContactInquiryEmail } from '../../lib/email/sender';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

const MAX_MESSAGE = 8000;
const MAX_NAME = 200;
const MAX_SHOP_NAME = 160;

const CURRENT_STACK_VALUES = new Set([
  'booksy',
  'fresha',
  'nearcut',
  'other-platform',
  'mixed-manual',
  'none',
]);

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function okResponse(delivered: boolean) {
  return new Response(JSON.stringify({ ok: true, delivered }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  if (!body || typeof body !== 'object') {
    return badRequest('Invalid payload.');
  }

  const record = body as Record<string, unknown>;

  // Honeypot first — bots fill hidden fields; silent accept without burning rate limit or sending mail.
  const companyWebsite =
    typeof record.companyWebsite === 'string' ? record.companyWebsite.trim() : '';
  if (companyWebsite) {
    return okResponse(false);
  }

  const limited = await enforceIpRateLimit(request, 'contact_form', 5, 15 * 60 * 1000);
  if (limited) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: limited.headers,
    });
  }

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  const intent = typeof record.intent === 'string' ? record.intent.trim() : '';
  const shopName = typeof record.shopName === 'string' ? record.shopName.trim() : '';
  const currentStack =
    typeof record.currentStack === 'string' ? record.currentStack.trim() : '';

  if (!name || name.length > MAX_NAME) {
    return badRequest('Please enter your name.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest('Please enter a valid email address.');
  }
  if (!shopName || shopName.length > MAX_SHOP_NAME) {
    return badRequest('Please enter your barbershop name.');
  }
  if (!CURRENT_STACK_VALUES.has(currentStack)) {
    return badRequest('Please select your current booking system.');
  }
  if (!message || message.length > MAX_MESSAGE) {
    return badRequest('Please enter a message.');
  }

  try {
    await sendContactInquiryEmail({
      name,
      email,
      shopName,
      message,
      intent: intent || undefined,
      currentStack,
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      console.error('[EMAIL] Contact inquiry failed', { email, error });
      return new Response(
        JSON.stringify({ ok: false, error: 'Could not send your message. Try again later.' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    throw error;
  }

  return okResponse(true);
};
