export const prerender = false;

import type { APIRoute } from 'astro';
import { EmailDeliveryError, sendContactInquiryEmail } from '../../lib/email/sender';

const MAX_MESSAGE = 8000;
const MAX_NAME = 200;
const MAX_META = 120;

function badRequest(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
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
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  const intent = typeof record.intent === 'string' ? record.intent.trim() : '';
  const shopSize = typeof record.shopSize === 'string' ? record.shopSize.trim() : '';
  const currentStack = typeof record.currentStack === 'string' ? record.currentStack.trim() : '';

  if (!name || name.length > MAX_NAME) {
    return badRequest('Please enter your name.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest('Please enter a valid email address.');
  }
  if (!message || message.length > MAX_MESSAGE) {
    return badRequest('Please enter a message.');
  }
  if (!shopSize || shopSize.length > MAX_META) {
    return badRequest('Please enter your shop size.');
  }
  if (!currentStack || currentStack.length > MAX_META) {
    return badRequest('Please enter your current booking stack.');
  }

  try {
    await sendContactInquiryEmail({
      name,
      email,
      message,
      intent: intent || undefined,
      shopSize,
      currentStack
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      console.error('[EMAIL] Contact inquiry failed', { email, error });
      return new Response(JSON.stringify({ ok: false, error: 'Could not send your message. Try again later.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
