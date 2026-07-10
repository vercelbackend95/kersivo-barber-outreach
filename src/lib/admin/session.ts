import { createHmac, timingSafeEqual } from 'node:crypto';

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
const ADMIN_SESSION_COOKIE = 'kersivo_admin_session';

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function getSessionSecret(): string | null {
  return import.meta.env.SERVER_SESSION_SECRET
    ?? process.env.SERVER_SESSION_SECRET
    ?? import.meta.env.ADMIN_SECRET
    ?? process.env.ADMIN_SECRET
    ?? null;
}

export function createAdminSessionToken(secret: string, barberId?: string): string {
  const exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS_IN_SECONDS;
  const payload = JSON.stringify(barberId ? { exp, barberId } : { exp });
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function parseAdminSessionToken(token: string, secret: string): { exp: number; barberId?: string } | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  const payload = fromBase64Url(encodedPayload);
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as { exp?: number; barberId?: string };
    if (!parsed.exp || typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    if (parsed.barberId !== undefined && typeof parsed.barberId !== 'string') return null;
    return { exp: parsed.exp, barberId: parsed.barberId };
  } catch {
    return null;
  }
}

export function verifyAdminSessionToken(token: string, secret: string): boolean {
  return parseAdminSessionToken(token, secret) !== null;
}

export function getAdminSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    maxAge: THIRTY_DAYS_IN_SECONDS,
    path: '/'
  };
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE;
}
