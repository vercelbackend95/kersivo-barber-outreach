export const prerender = false;

import type { APIRoute } from 'astro';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  getSessionSecret,
} from '../../../lib/admin/session';
import {
  clientIpFromRequest,
  countDurableRateLimitHits,
  consumeRateLimitSlot,
} from '@/lib/rate-limit/durableRateLimit';

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_FAIL_ACTION = 'admin_login_fail';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = (clientAddress?.trim() || clientIpFromRequest(request)).toLowerCase();

  const { count, oldestAt } = await countDurableRateLimitHits({
    key: ip,
    action: LOGIN_FAIL_ACTION,
    windowMs: FAILED_ATTEMPT_WINDOW_MS,
  });

  if (count >= MAX_FAILED_ATTEMPTS) {
    const now = Date.now();
    const oldestMs = oldestAt?.getTime() ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((FAILED_ATTEMPT_WINDOW_MS - (now - oldestMs)) / 1000),
    );
    return new Response(JSON.stringify({ error: 'Too many login attempts. Try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    });
  }

  const adminSecret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  const sessionSecret = getSessionSecret();
  let data: { secret?: unknown } | null = null;
  try {
    data = (await request.json()) as { secret?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), { status: 400 });
  }

  const submittedSecret = typeof data?.secret === 'string' ? data.secret : '';

  if (!adminSecret || !sessionSecret || submittedSecret !== adminSecret) {
    // Locked consume so concurrent failures cannot exceed the window limit.
    const slot = await consumeRateLimitSlot({
      key: ip,
      action: LOGIN_FAIL_ACTION,
      limit: MAX_FAILED_ATTEMPTS,
      windowMs: FAILED_ATTEMPT_WINDOW_MS,
    });
    if (!slot.ok) {
      return new Response(JSON.stringify({ error: 'Too many login attempts. Try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...(slot.retryAfterSeconds
            ? { 'Retry-After': String(slot.retryAfterSeconds) }
            : {}),
        },
      });
    }
    return new Response(JSON.stringify({ error: 'Invalid secret' }), { status: 401 });
  }

  const token = createAdminSessionToken(sessionSecret);
  cookies.set(
    getAdminSessionCookieName(),
    token,
    getAdminSessionCookieOptions(import.meta.env.PROD),
  );

  return new Response(JSON.stringify({ ok: true }));
};
