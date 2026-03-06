export const prerender = false;

import type { APIRoute } from 'astro';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  getSessionSecret
} from '../../../lib/admin/session';
type FailedLoginAttempt = {
  count: number;
  expiresAt: number;
};

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const failedAttemptsByIp = new Map<string, FailedLoginAttempt>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const firstForwardedIp = forwardedFor.split(',')[0]?.trim();
  if (firstForwardedIp) return firstForwardedIp;
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function hasExceededFailedAttempts(ip: string) {
  const attempt = failedAttemptsByIp.get(ip);
  if (!attempt) return false;
  if (Date.now() > attempt.expiresAt) {
    failedAttemptsByIp.delete(ip);
    return false;
  }
  return attempt.count >= MAX_FAILED_ATTEMPTS;
}

function registerFailedAttempt(ip: string) {
  const now = Date.now();
  const current = failedAttemptsByIp.get(ip);
  if (!current || now > current.expiresAt) {
    failedAttemptsByIp.set(ip, { count: 1, expiresAt: now + FAILED_ATTEMPT_WINDOW_MS });
    return;
  }

  failedAttemptsByIp.set(ip, {
    count: current.count + 1,
    expiresAt: current.expiresAt
  });
}


type FailedLoginAttempt = {
  count: number;
  expiresAt: number;
};

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED_IPS = 10_000;
const failedAttemptsByIp = new Map<string, FailedLoginAttempt>();

function normalizeIp(rawIp: string | undefined | null) {
  const trimmed = (rawIp ?? '').trim();
  if (!trimmed) return 'unknown';
  return trimmed.toLowerCase();
}

function getClientIp(clientAddress: string | undefined, request: Request) {
  if (clientAddress) return normalizeIp(clientAddress);

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return normalizeIp(realIp);

  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const firstForwardedIp = forwardedFor.split(',')[0];
  return normalizeIp(firstForwardedIp);
}

function cleanupExpiredAttempts(now: number) {
  for (const [ip, attempt] of failedAttemptsByIp.entries()) {
    if (now > attempt.expiresAt) {
      failedAttemptsByIp.delete(ip);
    }
  }
}

function hasExceededFailedAttempts(ip: string, now: number) {
  const attempt = failedAttemptsByIp.get(ip);
  if (!attempt) return false;
  if (now > attempt.expiresAt) {
    failedAttemptsByIp.delete(ip);
    return false;
  }
  return attempt.count >= MAX_FAILED_ATTEMPTS;
}

function registerFailedAttempt(ip: string, now: number) {
  const current = failedAttemptsByIp.get(ip);
  if (!current || now > current.expiresAt) {
    failedAttemptsByIp.set(ip, { count: 1, expiresAt: now + FAILED_ATTEMPT_WINDOW_MS });
    return;
  }

  failedAttemptsByIp.set(ip, {
    count: current.count + 1,
    expiresAt: current.expiresAt
  });
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const now = Date.now();
  cleanupExpiredAttempts(now);

  if (failedAttemptsByIp.size > MAX_TRACKED_IPS) {
    return new Response(JSON.stringify({ error: 'Rate limiter is busy. Try again shortly.' }), {
      status: 429
    });
  }

  const ip = getClientIp(clientAddress, request);

  if (hasExceededFailedAttempts(ip, now)) {
    return new Response(JSON.stringify({ error: 'Too many login attempts. Try again later.' }), {
      status: 429
    });
  }



  if (hasExceededFailedAttempts(ip)) {
    return new Response(JSON.stringify({ error: 'Too many login attempts. Try again later.' }), {
      status: 429
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
    registerFailedAttempt(ip);

    return new Response(JSON.stringify({ error: 'Invalid secret' }), { status: 401 });
  }
  failedAttemptsByIp.delete(ip);
  const token = createAdminSessionToken(sessionSecret);
  cookies.set(
    getAdminSessionCookieName(),
    token,
    getAdminSessionCookieOptions(import.meta.env.PROD)
  );

  return new Response(JSON.stringify({ ok: true }));
  
};
