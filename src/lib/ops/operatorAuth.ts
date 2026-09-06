import type { APIContext } from 'astro';

import { auth } from '@/lib/auth';

export type OperatorAccess = {
  userId: string;
  /** Normalized lowercase email — internal only; never put in API responses. */
  email: string;
  name?: string;
};

export type OperatorAuthFailureCode =
  | 'UNAUTHORIZED'
  | 'EMAIL_NOT_VERIFIED'
  | 'FORBIDDEN'
  | 'OPS_ACCESS_NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export type OperatorAuthResult =
  | { ok: true; access: OperatorAccess }
  | { ok: false; status: number; code: OperatorAuthFailureCode };

const OPS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
} as const;

/** Parse server-only allowlist. Fail closed when empty. */
export function parseOpsEmailAllowlist(raw: string | undefined | null): string[] {
  if (raw == null) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function readOpsEmailAllowlistFromEnv(): string[] {
  const raw =
    (typeof import.meta !== 'undefined' && import.meta.env?.KERSIVO_OPS_EMAILS) ||
    process.env.KERSIVO_OPS_EMAILS;
  return parseOpsEmailAllowlist(typeof raw === 'string' ? raw : undefined);
}

export function normalizeOperatorEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Platform-operator gate for internal Smart Retail ops APIs.
 * Does not accept tenant OWNER, preview, ADMIN_SECRET, legacy cookie, or CRON_SECRET.
 */
export async function resolveOperatorAccess(request: Request): Promise<OperatorAuthResult> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user;
    if (!user?.id) {
      return { ok: false, status: 401, code: 'UNAUTHORIZED' };
    }

    const email = normalizeOperatorEmail(user.email);
    if (!email) {
      return { ok: false, status: 401, code: 'UNAUTHORIZED' };
    }

    if (user.emailVerified !== true) {
      return { ok: false, status: 403, code: 'EMAIL_NOT_VERIFIED' };
    }

    const allowlist = readOpsEmailAllowlistFromEnv();
    if (allowlist.length === 0) {
      return { ok: false, status: 503, code: 'OPS_ACCESS_NOT_CONFIGURED' };
    }

    if (!allowlist.includes(email)) {
      return { ok: false, status: 403, code: 'FORBIDDEN' };
    }

    const name =
      typeof user.name === 'string' && user.name.trim().length > 0 ? user.name.trim() : undefined;

    return {
      ok: true,
      access: {
        userId: user.id,
        email,
        name,
      },
    };
  } catch {
    return { ok: false, status: 401, code: 'UNAUTHORIZED' };
  }
}

export function operatorAuthFailureResponse(
  result: Extract<OperatorAuthResult, { ok: false }>,
): Response {
  return new Response(JSON.stringify({ ok: false, error: { code: result.code } }), {
    status: result.status,
    headers: { ...OPS_HEADERS },
  });
}

/** Astro API helper: returns OperatorAccess or a Response to return immediately. */
export async function requireOperatorAccess(
  context: APIContext,
): Promise<OperatorAccess | Response> {
  const result = await resolveOperatorAccess(context.request);
  if (!result.ok) return operatorAuthFailureResponse(result);
  return result.access;
}

export const OPS_API_HEADERS = OPS_HEADERS;
