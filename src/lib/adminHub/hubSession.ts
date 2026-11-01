import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import type { HubStage } from '@/lib/freePreview/hubStage';

/**
 * `ks_hub`: the hub session that replaces the token in the URL once an owner has opened their email link
 * (docs/admin-hub/ADMIN_HUB_SPEC.md §2.2). It carries only the request id and an expiry; every request re-resolves
 * the PreviewRequest and its stage, so revoking (REJECTED) or expiring a request takes effect immediately.
 *
 * Owner:    v1.<previewRequestId>.<expUnix>.<hmac>
 * Operator: v1.<previewRequestId>.<expUnix>.op.<hmac>
 */
export const HUB_COOKIE_NAME = 'ks_hub';
const VERSION = 'v1';
const OPERATOR_FLAG = 'op';
const HKDF_INFO = 'ks-hub-v1';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const HMAC_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const HUB_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** An already expired preview still gets a short cookie so /admin can show the expired state. */
export const HUB_EXPIRED_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

export type HubSessionPayload = {
  previewRequestId: string;
  expiresAt: Date;
  operator: boolean;
};

function readEnv(name: string): string | undefined {
  const fromMeta = (import.meta.env as Record<string, string | undefined> | undefined)?.[name];
  return fromMeta || process.env[name];
}

/** Same secret as Better Auth (src/lib/auth.ts): no new env var. */
export function readHubSessionSecret(): string | null {
  const secret = readEnv('BETTER_AUTH_SECRET') || readEnv('ADMIN_SECRET') || '';
  return secret.trim() ? secret : null;
}

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), HKDF_INFO, 32));
}

function mac(key: Buffer, body: string): string {
  return createHmac('sha256', key).update(body).digest('base64url');
}

export function signHubSession(
  input: { previewRequestId: string; expiresAt: Date; operator?: boolean },
  secret: string | null = readHubSessionSecret(),
): string | null {
  if (!secret || !ID_PATTERN.test(input.previewRequestId)) return null;
  const exp = Math.floor(input.expiresAt.getTime() / 1000);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  const parts = [VERSION, input.previewRequestId, String(exp)];
  if (input.operator) parts.push(OPERATOR_FLAG);
  const body = parts.join('.');
  return `${body}.${mac(deriveKey(secret), body)}`;
}

export function verifyHubSession(
  value: string | null | undefined,
  now: Date = new Date(),
  secret: string | null = readHubSessionSecret(),
): HubSessionPayload | null {
  if (!secret || !value || value.length > 256) return null;
  const parts = value.split('.');
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [version, id, expRaw] = parts;
  if (version !== VERSION || !id || !ID_PATTERN.test(id) || !expRaw || !/^\d{1,12}$/.test(expRaw)) return null;
  const operator = parts.length === 5;
  if (operator && parts[3] !== OPERATOR_FLAG) return null;
  const presented = parts[parts.length - 1] ?? '';
  if (!HMAC_PATTERN.test(presented)) return null;

  const body = parts.slice(0, -1).join('.');
  const expected = Buffer.from(mac(deriveKey(secret), body), 'utf8');
  const given = Buffer.from(presented, 'utf8');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const expiresAt = new Date(Number(expRaw) * 1000);
  const nowMs = now.getTime();
  if (expiresAt.getTime() <= nowMs) return null;
  // Never honour a lifetime longer than we ever issue (defence in depth against a leaked key).
  if (expiresAt.getTime() > nowMs + (HUB_COOKIE_MAX_AGE_SECONDS + 60) * 1000) return null;
  return { previewRequestId: id, expiresAt, operator };
}

/** max age = min(30 days, preview expiry) while the preview can still expire; see the Batch 1 plan for the rest. */
export function hubCookieExpiry(input: { stage: HubStage; previewExpiresAt: Date | null }, now: Date): Date {
  const cap = now.getTime() + HUB_COOKIE_MAX_AGE_SECONDS * 1000;
  if (input.stage === 'expired') return new Date(now.getTime() + HUB_EXPIRED_COOKIE_MAX_AGE_SECONDS * 1000);
  const previewStage = input.stage === 'requested' || input.stage === 'designing' || input.stage === 'review';
  const expiry = input.previewExpiresAt?.getTime() ?? null;
  if (previewStage && expiry !== null && expiry > now.getTime()) return new Date(Math.min(cap, expiry));
  return new Date(cap);
}

const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';

export function serializeHubCookie(value: string, expiresAt: Date, now: Date = new Date()): string {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  return `${HUB_COOKIE_NAME}=${value}; Max-Age=${maxAge}; ${COOKIE_ATTRIBUTES}`;
}

export function clearHubCookie(): string {
  return `${HUB_COOKIE_NAME}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;
}

export function readHubCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === HUB_COOKIE_NAME) {
      const value = part.slice(index + 1).trim();
      return value || null;
    }
  }
  return null;
}

/** Mints the cookie for a resolved request. Null when no auth secret is configured. */
export function mintHubCookie(input: {
  previewRequestId: string;
  stage: HubStage;
  previewExpiresAt: Date | null;
  operator: boolean;
  now: Date;
}): string | null {
  const expiresAt = hubCookieExpiry({ stage: input.stage, previewExpiresAt: input.previewExpiresAt }, input.now);
  const value = signHubSession({
    previewRequestId: input.previewRequestId,
    expiresAt,
    operator: input.operator,
  });
  return value ? serializeHubCookie(value, expiresAt, input.now) : null;
}
