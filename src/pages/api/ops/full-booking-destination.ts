import type { APIContext } from 'astro';

import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';
import {
  FULL_DESTINATION_ATTESTATIONS,
  hasAllFullDestinationAttestations,
  invalidateFullBookingDestination,
  loadFullBookingDestinationOpsView,
  verifyFullBookingDestination,
} from '@/lib/shop/fullBookingDestination';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

function error(code: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: { code, ...extra } }, status);
}

/** Operator-only read: current authoritative Full destination + audit trail. ?shopId=… */
export async function GET(context: APIContext): Promise<Response> {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const shopId = new URL(context.request.url).searchParams.get('shopId')?.trim() ?? '';
  if (!shopId || shopId.length > 64) return error('INVALID_QUERY', 400);
  return json({ ok: true, data: await loadFullBookingDestinationOpsView(shopId) });
}

/**
 * Operator-only mutation (session allowlist + exact same-origin). Never customer-callable.
 * Body:
 *   { action: 'VERIFY', shopId, url, siteVersion?, replaceExisting?, attestations: {…all true} }
 *   { action: 'INVALIDATE', shopId, reason }
 */
export async function POST(context: APIContext): Promise<Response> {
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  let body: Record<string, unknown>;
  try {
    const parsed = await context.request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return error('INVALID_BODY', 400);
  }

  const shopId = typeof body.shopId === 'string' ? body.shopId.trim() : '';
  if (!shopId || shopId.length > 64) return error('INVALID_SHOP', 400);
  const actor = { userId: access.userId, email: access.email };

  if (body.action === 'VERIFY') {
    if (!hasAllFullDestinationAttestations(body.attestations)) {
      return error('ATTESTATIONS_REQUIRED', 400, { required: FULL_DESTINATION_ATTESTATIONS });
    }
    const result = await verifyFullBookingDestination({
      shopId,
      url: body.url,
      siteVersion: typeof body.siteVersion === 'string' ? body.siteVersion : null,
      replaceExisting: body.replaceExisting === true,
      actor,
    });
    if (!result.ok) {
      if (result.reason === 'INVALID_URL') return error('INVALID_URL', 400, { reason: result.code });
      if (result.reason === 'NOT_FOUND') return error('NOT_FOUND', 404);
      if (result.reason === 'PROTECTED_SHOP') return error('PROTECTED_SHOP', 409);
      if (result.reason === 'NOT_FULL') return error('NOT_FULL_KERSIVO', 409);
      return error('URL_CHANGE_NOT_CONFIRMED', 409);
    }
    return json({ ok: true, data: { outcome: result.outcome, destination: result.destination } });
  }

  if (body.action === 'INVALIDATE') {
    const result = await invalidateFullBookingDestination({ shopId, reason: body.reason, actor });
    if (!result.ok) {
      return result.reason === 'NOT_FOUND' ? error('NOT_FOUND', 404) : error('REASON_REQUIRED', 400);
    }
    return json({ ok: true, data: { outcome: result.outcome } });
  }

  return error('INVALID_ACTION', 400);
}
