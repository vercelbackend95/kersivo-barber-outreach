export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess, requireVerifiedEmail } from '@/lib/admin/auth';
import { accessCan, requirePermission } from '@/lib/admin/rbac/can';
import { deliverOutboxEmail } from '@/lib/email/outbox';
import { evaluateExactSameOrigin } from '@/lib/ops/requireOperatorMutation';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';
import {
  loadShopDepartureView,
  recordShopDepartureRequested,
  requestStarterDeparture,
} from '@/lib/shop/shopDeparture';
import { SHOP_DEPARTURE_CONFIRMATION_PHRASE } from '@/lib/shop/shopDepartureCopy';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Shop departure ("Leave KERSIVO"). The shop always comes from the signed-in session; preview,
 * secret, legacy and demo access are refused, and only the owner may request departure.
 */
async function resolveSessionAccess(context: Parameters<APIRoute>[0]) {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') return { response: json({ error: 'Unauthorized' }, 401) };
  if (isDemoShopId(access.shopId)) {
    return { response: json({ error: 'Not available for demo shops.' }, 403) };
  }
  return { access };
}

async function resolveOwnerAccess(context: Parameters<APIRoute>[0]) {
  const resolved = await resolveSessionAccess(context);
  if (!resolved.access) return resolved;
  const denied = requirePermission(resolved.access, 'billing.manage');
  if (denied) return { response: denied };
  return resolved;
}

/** Departure status for the signed-in shop team; only owners are offered the Leave action. */
export const GET: APIRoute = async (context) => {
  const resolved = await resolveSessionAccess(context);
  if (!resolved.access) return resolved.response;
  const view = await loadShopDepartureView(resolved.access.shopId);
  if (accessCan(resolved.access, 'billing.manage')) return json(view);
  return json({ ...view, canLeaveDirectly: false, fullKersivoActive: false });
};

export const POST: APIRoute = async (context) => {
  const origin = evaluateExactSameOrigin(context.request);
  if (!origin.ok) return json({ error: 'Forbidden', code: origin.code }, 403);

  const resolved = await resolveOwnerAccess(context);
  if (!resolved.access) return resolved.response;
  const { access } = resolved;
  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

  const contentType = context.request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected JSON.' }, 415);
  }
  const body: unknown = await context.request.json().catch(() => null);
  const confirmation =
    body && typeof body === 'object' ? String((body as { confirm?: unknown }).confirm ?? '') : '';
  if (confirmation.trim() !== SHOP_DEPARTURE_CONFIRMATION_PHRASE) {
    return json(
      {
        error: `Type ${SHOP_DEPARTURE_CONFIRMATION_PHRASE} to confirm.`,
        code: 'CONFIRMATION_REQUIRED',
      },
      400,
    );
  }

  const email = access.userEmail?.trim() ?? '';
  const result = await requestStarterDeparture({
    shopId: access.shopId,
    userId: access.userId ?? null,
    email,
  });

  if (!result.ok) {
    switch (result.code) {
      case 'FULL_KERSIVO_ACTIVE':
        return json(
          {
            error:
              'Full KERSIVO is active. Cancel Full KERSIVO in Billing and choose "Leave KERSIVO" for after the paid period.',
            code: result.code,
          },
          409,
        );
      case 'NOT_ACTIVE_STARTER':
        return json(
          { error: 'This shop does not have an active KERSIVO Starter plan to leave.', code: result.code },
          409,
        );
      case 'SHOP_NOT_FOUND':
        return json({ error: 'Shop not found.' }, 404);
      case 'PROTECTED_SHOP':
      default:
        return json({ error: 'Not available for this shop.' }, 403);
    }
  }

  if (result.created) {
    if (result.outboxId) await deliverOutboxEmail(result.outboxId).catch(() => undefined);
    await recordShopDepartureRequested({
      shopId: access.shopId,
      userId: access.userId ?? null,
      email: email || null,
      departure: result.departure,
    });
  }

  return json({ ok: true, created: result.created, departure: result.departure });
};
