import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const replaceShopOpeningHours = vi.fn();
const writeShopPublicProfile = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopOpeningHours: { findMany: async () => [] },
    shopSettings: { findUnique: async () => ({ name: 'Shop', townCity: null }) },
    shopPublicProfile: { findUnique: async () => null },
  },
}));
vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubDetailsRate: async () => null,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
  };
});
vi.mock('@/lib/admin/shopOpeningHours', () => ({
  replaceShopOpeningHours: (...args: unknown[]) => replaceShopOpeningHours(...args),
}));
vi.mock('@/lib/shopData/profile', () => ({
  writeShopPublicProfile: (...args: unknown[]) => writeShopPublicProfile(...args),
}));
vi.mock('@/lib/adminHub/ownerEditEvents', () => ({ recordDebouncedPreviewRequestEvent: async () => undefined }));

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { defaultOpeningWeek } from '@/lib/shopData/openingHours';
import { createHubOpeningHoursHandlers, createHubProfileHandlers, HUB_SHOP_NOT_READY } from './shopSetup';

function ctx(over: { draftShopId?: string | null; stage?: string; canEditDetails?: boolean } = {}) {
  return {
    ok: true,
    ctx: {
      request: { id: 'req_1', draftShopId: over.draftShopId === undefined ? 'shop_1' : over.draftShopId },
      state: { stage: over.stage ?? 'designing', capabilities: { canEditDetails: over.canEditDetails ?? true } },
      isOperator: false,
    },
  };
}

function call(method: string, body: unknown) {
  return {
    request: new Request('http://localhost/api/admin-hub/x', {
      method,
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
  } as never;
}

const hours = createHubOpeningHoursHandlers(cookieSourceOf);
const profile = createHubProfileHandlers(cookieSourceOf);

beforeEach(() => {
  resolveHubApiContext.mockReset().mockResolvedValue(ctx());
  replaceShopOpeningHours.mockReset().mockResolvedValue(undefined);
  writeShopPublicProfile.mockReset().mockResolvedValue(undefined);
});

describe('hub opening hours and business details endpoints', () => {
  it("writes the draft shop's canonical opening hours", async () => {
    const res = await hours.PUT(call('PUT', { days: defaultOpeningWeek() }));
    expect(res.status).toBe(200);
    expect(replaceShopOpeningHours).toHaveBeenCalledWith(
      'shop_1',
      expect.arrayContaining([
        { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' },
      ]),
    );
  });

  it('rejects a closing time before the opening time', async () => {
    const days = defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, closes: '08:00' } : d));
    const res = await hours.PUT(call('PUT', { days }));
    expect(res.status).toBe(400);
    expect(replaceShopOpeningHours).not.toHaveBeenCalled();
  });

  it('asks for a shop first when there is no draft shop or the stage is past editing', async () => {
    resolveHubApiContext.mockResolvedValueOnce(ctx({ draftShopId: null }));
    const noShop = await hours.PUT(call('PUT', { days: defaultOpeningWeek() }));
    expect(noShop.status).toBe(409);
    expect((await noShop.json()).error).toBe(HUB_SHOP_NOT_READY);
    resolveHubApiContext.mockResolvedValueOnce(ctx({ stage: 'live' }));
    expect((await profile.PATCH(call('PATCH', { phone: '0161' }))).status).toBe(409);
    expect(writeShopPublicProfile).not.toHaveBeenCalled();
  });

  it('refuses a viewer without edit rights', async () => {
    resolveHubApiContext.mockResolvedValueOnce(ctx({ canEditDetails: false }));
    expect((await profile.PATCH(call('PATCH', { phone: '0161' }))).status).toBe(403);
  });

  it('saves business details through the shared profile writer', async () => {
    const res = await profile.PATCH(call('PATCH', { addressLine1: '2 Example Road', postcode: 'm1 1ae', email: null }));
    expect(res.status).toBe(200);
    expect(writeShopPublicProfile).toHaveBeenCalledWith(
      expect.anything(),
      'shop_1',
      expect.objectContaining({ addressLine1: '2 Example Road', email: null }),
    );
    expect(writeShopPublicProfile.mock.calls[0]![2].postcode).toBe('M1 1AE');
  });
});
