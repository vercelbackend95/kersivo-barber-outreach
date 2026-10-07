export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';

const EVENT_ACTIONS = {
  viewed: ACCOUNT_LIFECYCLE_ACTIONS.STARTER_PAYMENT_SETTINGS_UPGRADE_VIEWED,
  clicked: ACCOUNT_LIFECYCLE_ACTIONS.STARTER_PAYMENT_SETTINGS_UPGRADE_CLICKED,
} as const;

const PLACEMENTS = new Set(['barbershop_settings_payments']);

const noContent = () => new Response(null, { status: 204 });

/**
 * Server-side record of the Starter payment-settings upgrade prompt (view / click). Starter only,
 * shop-scoped, no personal data. Never blocks the UI: anything but auth failure answers 204.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['shop.settings', 'billing.manage']);
  if (denied) return denied;

  try {
    const body = (await ctx.request.json().catch(() => null)) as
      | { event?: unknown; placement?: unknown }
      | null;
    const event = typeof body?.event === 'string' ? body.event : '';
    if (event !== 'viewed' && event !== 'clicked') return noContent();
    const placement =
      typeof body?.placement === 'string' && PLACEMENTS.has(body.placement)
        ? body.placement
        : 'barbershop_settings_payments';

    const productAccess = await loadKersivoAccess(access.shopId);
    if (productAccess.state !== 'FREE_BOOKING') return noContent();

    await recordAccountLifecycleEvent({
      action: EVENT_ACTIONS[event],
      shopId: access.shopId,
      meta: { event: `starter_payment_settings_upgrade_${event}`, placement },
    });
  } catch (error) {
    console.error('[starter-upgrade-event] failed', error);
  }
  return noContent();
};
