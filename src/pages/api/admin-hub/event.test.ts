import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const sendServerAnalyticsEvent = vi.fn();
const isAdminHubRouteEnabled = vi.fn();

vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
  };
});
vi.mock('@/lib/freePreview/hubPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubPage')>();
  return {
    ...actual,
    isAdminHubRouteEnabled: () => isAdminHubRouteEnabled(),
  };
});
vi.mock('@/lib/analytics/serverEvents', () => ({
  analyticsClientIdFromRequest: () => 'cid',
  sendServerAnalyticsEvent: (...args: unknown[]) => sendServerAnalyticsEvent(...args),
}));
vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({ enforceIpRateLimit: async () => null }));

import { POST } from './event';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';

beforeEach(() => {
  isAdminHubRouteEnabled.mockReturnValue(true);
  resolveHubApiContext.mockResolvedValue({ ok: true, ctx: { isOperator: false } });
  sendServerAnalyticsEvent.mockReset();
});
afterEach(() => vi.clearAllMocks());

function post(body?: unknown) {
  return POST({
    request: new Request('http://localhost/api/admin-hub/event', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as never);
}

describe('POST /api/admin-hub/event', () => {
  it('keeps an empty body as preview_launch_click', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith({
      name: FUNNEL_EVENTS.preview_launch_click,
      clientId: 'cid',
      params: undefined,
    });
  });

  it('accepts the add-menu allowlist and drops unknown names', async () => {
    expect((await post({ name: 'hub_add_menu_open' })).status).toBe(200);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith({
      name: FUNNEL_EVENTS.hub_add_menu_open,
      clientId: 'cid',
      params: undefined,
    });

    sendServerAnalyticsEvent.mockClear();
    expect((await post({ name: 'hub_add_menu_item', item: 'photos' })).status).toBe(200);
    expect(sendServerAnalyticsEvent).toHaveBeenCalledWith({
      name: FUNNEL_EVENTS.hub_add_menu_item,
      clientId: 'cid',
      params: { item: 'photos' },
    });

    sendServerAnalyticsEvent.mockClear();
    expect((await post({ name: 'hub_add_menu_item', item: 'email@shop.com' })).status).toBe(200);
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();

    sendServerAnalyticsEvent.mockClear();
    expect((await post({ name: 'not_a_real_event' })).status).toBe(200);
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('does not send events for operators', async () => {
    resolveHubApiContext.mockResolvedValue({ ok: true, ctx: { isOperator: true } });
    expect((await post({ name: 'hub_add_menu_open' })).status).toBe(200);
    expect(sendServerAnalyticsEvent).not.toHaveBeenCalled();
  });
});
