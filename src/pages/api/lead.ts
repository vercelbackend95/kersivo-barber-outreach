export const prerender = false;

import type { APIRoute } from 'astro';
import { EmailDeliveryError, sendDemoCaptureLeadEmail } from '../../lib/email/sender';

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
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const shopName = typeof record.shopName === 'string' ? record.shopName.trim() : '';
  const currentSystem = typeof record.currentSystem === 'string' ? record.currentSystem.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest('Please enter a valid email address.');
  }
  if (!shopName || shopName.length > MAX_NAME) {
    return badRequest('Please enter your barbershop name.');
  }
  if (currentSystem.length > MAX_META) {
    return badRequest('Invalid current system value.');
  }

  try {
    await sendDemoCaptureLeadEmail({
      email,
      shopName,
      currentSystem: currentSystem || undefined
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not send your request. Try again later.' }), {
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
