import type { APIContext } from 'astro';

import {
  OPS_API_HEADERS,
  type OperatorAccess,
  requireOperatorAccess,
} from '@/lib/ops/operatorAuth';

function jsonError(code: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: { code } }), {
    status,
    headers: { ...OPS_API_HEADERS },
  });
}

/**
 * Exact same-origin check for operator mutations.
 * Does not trust Referer, Vercel wildcards, or allowlists — Origin must equal request URL origin.
 *
 * Requires a canonical serialized origin: scheme + host + optional port only.
 * Rejects path, query, fragment, userinfo, `null`, and multi-value Origin headers.
 */
export function evaluateExactSameOrigin(request: Request):
  | { ok: true }
  | { ok: false; code: 'MISSING_ORIGIN' | 'MALFORMED_ORIGIN' | 'CROSS_ORIGIN' } {
  const originHeader = request.headers.get('origin');
  if (originHeader == null || originHeader.trim() === '') {
    return { ok: false, code: 'MISSING_ORIGIN' };
  }

  const raw = originHeader.trim();
  if (raw === 'null' || /[\s,]/.test(raw)) {
    return { ok: false, code: 'MALFORMED_ORIGIN' };
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return { ok: false, code: 'MALFORMED_ORIGIN' };
  }

  let providedOrigin: string;
  try {
    providedOrigin = new URL(raw).origin;
  } catch {
    return { ok: false, code: 'MALFORMED_ORIGIN' };
  }

  // Canonical form only: raw header must equal URL.origin (no path/query/fragment/userinfo).
  if (raw !== providedOrigin) {
    return { ok: false, code: 'MALFORMED_ORIGIN' };
  }

  if (providedOrigin !== requestOrigin) {
    return { ok: false, code: 'CROSS_ORIGIN' };
  }

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite != null && secFetchSite.trim() !== '' && secFetchSite.trim() !== 'same-origin') {
    return { ok: false, code: 'CROSS_ORIGIN' };
  }

  return { ok: true };
}

function isApplicationJson(contentType: string | null): boolean {
  if (!contentType) return false;
  const media = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return media === 'application/json';
}

/**
 * Operator mutation gate: session allowlist + POST + JSON + exact same-origin Origin.
 * Unauthorized paths must not create audit rows (caller responsibility).
 */
export async function requireOperatorMutation(
  context: APIContext,
): Promise<OperatorAccess | Response> {
  const method = context.request.method.toUpperCase();
  if (method !== 'POST') {
    return jsonError('METHOD_NOT_ALLOWED', 405);
  }

  if (!isApplicationJson(context.request.headers.get('content-type'))) {
    return jsonError('WRONG_CONTENT_TYPE', 415);
  }

  const originCheck = evaluateExactSameOrigin(context.request);
  if (!originCheck.ok) {
    const status = originCheck.code === 'MISSING_ORIGIN' || originCheck.code === 'MALFORMED_ORIGIN'
      ? 403
      : 403;
    return jsonError(originCheck.code, status);
  }

  return requireOperatorAccess(context);
}
