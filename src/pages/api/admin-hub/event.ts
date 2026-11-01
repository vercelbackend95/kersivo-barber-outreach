export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { parseAdminHubAddItem } from '@/lib/adminHub/addMenu';
import { hubJson, hubNotFoundJson, resolveHubApiContext } from '@/lib/freePreview/hubApi';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { PREVIEW_EVENT_RATE } from '@/lib/freePreview/previewApi';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

const HUB_EVENT_NAMES = {
  preview_launch_click: FUNNEL_EVENTS.preview_launch_click,
  hub_add_menu_open: FUNNEL_EVENTS.hub_add_menu_open,
  hub_add_menu_item: FUNNEL_EVENTS.hub_add_menu_item,
} as const;

type HubClientEventName = keyof typeof HUB_EVENT_NAMES;

function parseEventName(raw: unknown): HubClientEventName | null {
  return typeof raw === 'string' && raw in HUB_EVENT_NAMES ? (raw as HubClientEventName) : null;
}

async function readEventBody(request: Request): Promise<{ name: HubClientEventName; item?: string } | null> {
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    return { name: 'preview_launch_click' };
  }
  if (!raw || typeof raw !== 'object') return { name: 'preview_launch_click' };
  const body = raw as { name?: unknown; item?: unknown };
  if (body.name === undefined || body.name === null || body.name === '') {
    return { name: 'preview_launch_click' };
  }
  const name = parseEventName(body.name);
  if (!name) return null;
  if (name !== 'hub_add_menu_item') return { name };
  const item = parseAdminHubAddItem(typeof body.item === 'string' ? body.item : null);
  if (!item) return null;
  return { name, item };
}

/** Allowlisted hub analytics. Empty body stays preview_launch_click. Never sent for operators. */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminHubRouteEnabled()) return hubNotFoundJson();

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_EVENT_RATE.action,
    PREVIEW_EVENT_RATE.limit,
    PREVIEW_EVENT_RATE.windowMs,
  );
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, source: { kind: 'cookie' }, mutation: true });
  if (!ctxResult.ok) return ctxResult.response;

  const event = await readEventBody(request);
  if (!event) return hubJson({ ok: true });

  if (!ctxResult.ctx.isOperator) {
    await sendServerAnalyticsEvent({
      name: HUB_EVENT_NAMES[event.name],
      clientId: analyticsClientIdFromRequest(request),
      params: event.item ? { item: event.item } : undefined,
    });
  }
  return hubJson({ ok: true });
};
