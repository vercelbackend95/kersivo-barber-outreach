import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';

const requireAdminContext = vi.fn();
const requireAnyPermission = vi.fn();
const shopSettingsFindUnique = vi.fn();
const shopSettingsUpdate = vi.fn();
const serializeShopOpeningHours = vi.fn();
const replaceShopOpeningHours = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/admin/rbac/can', () => ({
  requireAnyPermission: (...args: unknown[]) => requireAnyPermission(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
      update: (...args: unknown[]) => shopSettingsUpdate(...args),
    },
  },
}));

vi.mock('@/lib/admin/shopOpeningHours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/shopOpeningHours')>();
  return {
    ...actual,
    serializeShopOpeningHours: (...args: unknown[]) => serializeShopOpeningHours(...args),
    replaceShopOpeningHours: (...args: unknown[]) => replaceShopOpeningHours(...args),
  };
});

vi.mock('@/lib/storage/storeShopLogo', () => ({
  storeShopLogo: vi.fn(),
}));

import { GET } from './index';
import { PUT as putIdentity } from './identity';
import { PUT as putHours } from './hours';
import { PATCH as patchPause } from './pause';
import { DEFAULT_ONBOARDING_HOURS } from '@/lib/admin/shopOpeningHours';

function jsonCtx(path: string, method: string, body?: unknown): APIContext {
  return {
    request: new Request(`http://localhost${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  } as unknown as APIContext;
}

describe('barbershop-settings APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'u1',
      role: 'OWNER',
      via: 'session',
      permissions: ['shop.settings'],
    });
    requireAnyPermission.mockReturnValue(null);
    serializeShopOpeningHours.mockResolvedValue(DEFAULT_ONBOARDING_HOURS);
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPauseReason: null,
    });
  });

  it('GET returns identity, hours, and pause', async () => {
    shopSettingsFindUnique.mockResolvedValue({
      name: 'Ace Cuts',
      townCity: 'London',
      logoUrl: null,
      timezone: 'Europe/London',
      publicActivityPaused: false,
      publicActivityPausedAt: null,
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: null,
    });
    const res = await GET(jsonCtx('/api/admin/barbershop-settings', 'GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.identity.name).toBe('Ace Cuts');
    expect(data.hours).toHaveLength(7);
    expect(data.pause.paused).toBe(false);
    expect(data.pause.pausedNow).toBe(false);
    expect(data.pause.from).toBeNull();
    expect(data.pause.locked).toBe(false);
    expect(data.pause.lockedMessage).toBeNull();
    expect(requireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining(['shop.settings']),
    );
  });

  it('GET marks pause locked for preview via', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: null,
      role: 'OWNER',
      via: 'preview',
      permissions: ['shop.settings'],
    });
    shopSettingsFindUnique.mockResolvedValue({
      name: 'Ace Cuts',
      townCity: 'London',
      logoUrl: null,
      timezone: 'Europe/London',
      publicActivityPaused: true,
      publicActivityPausedAt: new Date(),
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: 'Shop under construction — goes live after subscription.',
    });
    const res = await GET(jsonCtx('/api/admin/barbershop-settings', 'GET'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.pause.locked).toBe(true);
    expect(data.pause.lockedMessage).toMatch(/preview shop/i);
  });

  it('GET rejects without shop.settings', async () => {
    requireAnyPermission.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    );
    const res = await GET(jsonCtx('/api/admin/barbershop-settings', 'GET'));
    expect(res.status).toBe(403);
  });

  it('PUT identity updates name', async () => {
    shopSettingsUpdate.mockResolvedValue({
      name: 'New Name',
      townCity: null,
      logoUrl: null,
    });
    const res = await putIdentity(
      jsonCtx('/api/admin/barbershop-settings/identity', 'PUT', {
        name: 'New Name',
        townCity: null,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.identity.name).toBe('New Name');
  });

  it('PUT hours validates and saves', async () => {
    replaceShopOpeningHours.mockResolvedValue(undefined);
    serializeShopOpeningHours.mockResolvedValue(DEFAULT_ONBOARDING_HOURS);
    const res = await putHours(
      jsonCtx('/api/admin/barbershop-settings/hours', 'PUT', {
        rules: DEFAULT_ONBOARDING_HOURS,
      }),
    );
    expect(res.status).toBe(200);
    expect(replaceShopOpeningHours).toHaveBeenCalledWith('shop-1', DEFAULT_ONBOARDING_HOURS);
  });

  it('PUT hours rejects all closed days', async () => {
    const closed = DEFAULT_ONBOARDING_HOURS.map((row) => ({ ...row, active: false }));
    const res = await putHours(
      jsonCtx('/api/admin/barbershop-settings/hours', 'PUT', { rules: closed }),
    );
    expect(res.status).toBe(400);
    expect(replaceShopOpeningHours).not.toHaveBeenCalled();
  });

  it('PATCH pause arms with dates and reason', async () => {
    const pausedAt = new Date('2026-07-24T12:00:00.000Z');
    shopSettingsUpdate.mockResolvedValue({
      publicActivityPaused: true,
      publicActivityPausedAt: pausedAt,
      publicActivityPauseFrom: new Date('2026-08-01T12:00:00.000Z'),
      publicActivityPauseUntil: new Date('2026-08-05T12:00:00.000Z'),
      publicActivityPauseReason: 'Closed for renovation until 5 Aug.',
      timezone: 'Europe/London',
    });
    const res = await patchPause(
      jsonCtx('/api/admin/barbershop-settings/pause', 'PATCH', {
        paused: true,
        from: '2026-08-01',
        until: '2026-08-05',
        reason: 'Closed for renovation until 5 Aug.',
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pause.paused).toBe(true);
    expect(data.pause.from).toBe('2026-08-01');
    expect(data.pause.until).toBe('2026-08-05');
    expect(data.pause.reason).toBe('Closed for renovation until 5 Aug.');
    expect(shopSettingsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicActivityPaused: true,
          publicActivityPauseReason: 'Closed for renovation until 5 Aug.',
        }),
      }),
    );
  });

  it('PATCH pause rejects short reason', async () => {
    const res = await patchPause(
      jsonCtx('/api/admin/barbershop-settings/pause', 'PATCH', {
        paused: true,
        from: '2026-08-01',
        until: '2026-08-05',
        reason: 'short',
      }),
    );
    expect(res.status).toBe(400);
    expect(shopSettingsUpdate).not.toHaveBeenCalled();
  });

  it('PATCH pause rejects inverted date range', async () => {
    const res = await patchPause(
      jsonCtx('/api/admin/barbershop-settings/pause', 'PATCH', {
        paused: true,
        from: '2026-08-10',
        until: '2026-08-05',
        reason: 'Closed for renovation until later.',
      }),
    );
    expect(res.status).toBe(400);
    expect(shopSettingsUpdate).not.toHaveBeenCalled();
  });

  it('PATCH pause clears fields on resume', async () => {
    shopSettingsFindUnique.mockResolvedValue({ publicActivityPauseReason: null });
    shopSettingsUpdate.mockResolvedValue({
      publicActivityPaused: false,
      publicActivityPausedAt: null,
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: null,
      timezone: 'Europe/London',
    });
    const res = await patchPause(
      jsonCtx('/api/admin/barbershop-settings/pause', 'PATCH', { paused: false }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pause.paused).toBe(false);
    expect(data.pause.from).toBeNull();
    expect(shopSettingsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicActivityPaused: false,
          publicActivityPauseFrom: null,
          publicActivityPauseUntil: null,
          publicActivityPauseReason: null,
        }),
      }),
    );
  });

  it('PATCH pause rejects resume for preview shops', async () => {
    requireAdminContext.mockResolvedValue({
      shopId: 'shop-1',
      userId: null,
      role: 'OWNER',
      via: 'preview',
      permissions: ['shop.settings'],
    });
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPauseReason: 'Shop under construction — goes live after subscription.',
    });
    const res = await patchPause(
      jsonCtx('/api/admin/barbershop-settings/pause', 'PATCH', { paused: false }),
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe('PREVIEW_PAUSE_LOCKED');
    expect(shopSettingsUpdate).not.toHaveBeenCalled();
  });
});
