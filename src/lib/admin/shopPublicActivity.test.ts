import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shopSettingsFindUnique = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
    },
  },
}));

import {
  assertShopAcceptingPublicActivity,
  assertShopAcceptingPublicBookingsOnDate,
  getShopPublicActivityPauseOnDate,
  isPauseActiveNow,
  isPauseActiveOnIsoDate,
  isShopPublicActivityPaused,
  isoDateToStoredPauseDate,
  pauseReasonMessage,
  ShopPublicActivityPausedError,
  SHOP_PUBLIC_ACTIVITY_PAUSED_MESSAGE,
} from './shopPublicActivity';

describe('shopPublicActivity', () => {
  beforeEach(() => {
    shopSettingsFindUnique.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats armed pause without dates as full block (legacy)', () => {
    const shop = { publicActivityPaused: true };
    expect(isPauseActiveOnIsoDate(shop, '2026-07-24')).toBe(true);
    expect(isPauseActiveNow(shop, new Date('2026-07-24T12:00:00.000Z'))).toBe(true);
  });

  it('blocks only dates inside the armed range', () => {
    const shop = {
      publicActivityPaused: true,
      publicActivityPauseFrom: isoDateToStoredPauseDate('2026-08-01'),
      publicActivityPauseUntil: isoDateToStoredPauseDate('2026-08-05'),
      publicActivityPauseReason: 'Closed for renovation until 5 Aug.',
      timezone: 'Europe/London',
    };
    expect(isPauseActiveOnIsoDate(shop, '2026-07-31')).toBe(false);
    expect(isPauseActiveOnIsoDate(shop, '2026-08-01')).toBe(true);
    expect(isPauseActiveOnIsoDate(shop, '2026-08-05')).toBe(true);
    expect(isPauseActiveOnIsoDate(shop, '2026-08-06')).toBe(false);
    expect(pauseReasonMessage(shop)).toBe('Closed for renovation until 5 Aug.');
  });

  it('reports paused now only when today is in range', () => {
    const shop = {
      publicActivityPaused: true,
      publicActivityPauseFrom: isoDateToStoredPauseDate('2026-08-01'),
      publicActivityPauseUntil: isoDateToStoredPauseDate('2026-08-05'),
      timezone: 'Europe/London',
    };
    expect(isPauseActiveNow(shop, new Date('2026-07-24T12:00:00.000Z'))).toBe(false);
    expect(isPauseActiveNow(shop, new Date('2026-08-03T12:00:00.000Z'))).toBe(true);
  });

  it('loads date pause with owner reason', async () => {
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPaused: true,
      publicActivityPauseFrom: isoDateToStoredPauseDate('2026-08-01'),
      publicActivityPauseUntil: isoDateToStoredPauseDate('2026-08-05'),
      publicActivityPauseReason: 'Renovating the chairs.',
      timezone: 'Europe/London',
    });
    await expect(getShopPublicActivityPauseOnDate('shop-1', '2026-08-02')).resolves.toEqual({
      paused: true,
      reason: 'Renovating the chairs.',
    });
    await expect(getShopPublicActivityPauseOnDate('shop-1', '2026-07-20')).resolves.toEqual({
      paused: false,
      reason: null,
    });
  });

  it('throws assert for now with owner reason', async () => {
    // "Now" decides this one, so pin it inside the armed window.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPaused: true,
      publicActivityPauseFrom: isoDateToStoredPauseDate('2026-07-20'),
      publicActivityPauseUntil: isoDateToStoredPauseDate('2026-07-30'),
      publicActivityPauseReason: 'Holiday closure — see you soon.',
      timezone: 'Europe/London',
    });
    await expect(assertShopAcceptingPublicActivity('shop-1')).rejects.toMatchObject({
      name: 'ShopPublicActivityPausedError',
      message: 'Holiday closure — see you soon.',
      code: 'SHOP_PUBLIC_ACTIVITY_PAUSED',
    });

    vi.setSystemTime(new Date('2026-07-31T12:00:00.000Z'));
    await expect(assertShopAcceptingPublicActivity('shop-1')).resolves.toBeUndefined();
  });

  it('throws booking assert only for paused dates', async () => {
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPaused: true,
      publicActivityPauseFrom: isoDateToStoredPauseDate('2026-08-01'),
      publicActivityPauseUntil: isoDateToStoredPauseDate('2026-08-05'),
      publicActivityPauseReason: 'Renovating.',
      timezone: 'Europe/London',
    });
    await expect(assertShopAcceptingPublicBookingsOnDate('shop-1', '2026-07-24')).resolves.toBeUndefined();
    await expect(assertShopAcceptingPublicBookingsOnDate('shop-1', '2026-08-02')).rejects.toBeInstanceOf(
      ShopPublicActivityPausedError,
    );
  });

  it('falls back to default message when reason missing', async () => {
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPaused: true,
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: null,
      timezone: 'Europe/London',
    });
    expect(await isShopPublicActivityPaused('shop-1')).toBe(true);
    await expect(assertShopAcceptingPublicActivity('shop-1')).rejects.toMatchObject({
      message: SHOP_PUBLIC_ACTIVITY_PAUSED_MESSAGE,
    });
  });

  it('allows activity when not armed', async () => {
    shopSettingsFindUnique.mockResolvedValue({
      publicActivityPaused: false,
      publicActivityPauseFrom: null,
      publicActivityPauseUntil: null,
      publicActivityPauseReason: null,
      timezone: 'Europe/London',
    });
    await expect(assertShopAcceptingPublicActivity('shop-1')).resolves.toBeUndefined();
  });
});
