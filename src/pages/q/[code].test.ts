import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { resolveQrDestination } from '@/lib/qr/qrDestination';

type ShopRow = {
  id: string;
  bookingSlug: string | null;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  freeBookingActivatedAt: Date | null;
};

const db = vi.hoisted(() => ({
  qr: new Map<string, { shopId: string; placement: 'WINDOW' | 'REBOOK' }>(),
  shops: new Map<string, ShopRow>(),
  subscription: null as null | Record<string, unknown>,
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopQrCode: {
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) => {
        const qr = db.qr.get(where.code);
        if (!qr) return null;
        const shop = db.shops.get(qr.shopId)!;
        return { shop: { id: shop.id, bookingSlug: shop.bookingSlug } };
      }),
    },
    shopSettings: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const shop = db.shops.get(where.id);
        return shop ? { ...shop } : null;
      }),
    },
    saasSubscription: {
      findFirst: vi.fn(async () => db.subscription),
    },
  },
}));

import { GET } from './[code]';

const WINDOW_CODE = 'H7K3PX9M2QAB';
const REBOOK_CODE = 'R4BKZ8N2W6CD';

function scan(code: string) {
  return GET({ params: { code } } as unknown as APIContext);
}

function shop(overrides: Partial<ShopRow> = {}): ShopRow {
  return {
    id: 'cmshop1',
    bookingSlug: 'blackline-barbers',
    shopPaidAt: null,
    smsRemindersEnabled: false,
    freeBookingActivatedAt: null,
    ...overrides,
  };
}

function expectQrHeaders(res: Response) {
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
}

describe('GET /q/{code}', () => {
  beforeEach(() => {
    db.qr.clear();
    db.shops.clear();
    db.subscription = null;
    db.qr.set(WINDOW_CODE, { shopId: 'cmshop1', placement: 'WINDOW' });
    db.qr.set(REBOOK_CODE, { shopId: 'cmshop1', placement: 'REBOOK' });
  });

  it('X: unknown and malformed codes are 404', async () => {
    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date() }));
    for (const code of ['ZZZZZZZZZZZZ', 'bad', '../admin']) {
      const res = await scan(code);
      expect(res.status).toBe(404);
      expectQrHeaders(res);
    }
  });

  it('Y: a SETUP shop gets no public redirect', async () => {
    db.shops.set('cmshop1', shop());
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(404);
    expect(res.headers.get('Location')).toBeNull();
    expectQrHeaders(res);
  });

  it('Z: a FREE_BOOKING shop gets a temporary redirect to /book/{slug}', async () => {
    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('AA: a FULL_KERSIVO shop currently uses the documented KERSIVO slug fallback', async () => {
    db.shops.set('cmshop1', shop());
    db.subscription = { status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01') };
    const res = await scan(REBOOK_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
    expect(
      resolveQrDestination({ state: 'FULL_KERSIVO', shop: { id: 'cmshop1', bookingSlug: 'blackline-barbers' } }),
    ).toEqual({
      kind: 'redirect',
      path: '/book/blackline-barbers',
      source: 'full_kersivo_temporary_slug_fallback',
    });
  });

  it('AA: a legacy Full shop without a slug falls back to its legacy booking route', async () => {
    db.shops.set('cmshop1', shop({ bookingSlug: null, shopPaidAt: new Date('2026-01-01') }));
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/cmshop1');
  });

  it('AB: the same code follows CURRENT entitlement rather than a stored destination', async () => {
    db.shops.set('cmshop1', shop());
    expect((await scan(WINDOW_CODE)).status).toBe(404);

    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');

    db.subscription = { status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01') };
    const full = await scan(WINDOW_CODE);
    expect(full.status).toBe(302);

    // FULL → FREE: subscription ends, the same code returns to the Free slug route.
    db.subscription = { status: 'CANCELED', currentPeriodEnd: new Date('2000-01-01') };
    const backToFree = await scan(WINDOW_CODE);
    expect(backToFree.status).toBe(302);
    expect(backToFree.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('AC: redirects are non-permanent and carry no-store / noindex headers', async () => {
    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    const res = await scan(REBOOK_CODE.toLowerCase());
    expect(res.status).toBe(302);
    expect([301, 308]).not.toContain(res.status);
    expectQrHeaders(res);
  });

  it('WINDOW and REBOOK are distinct codes resolving to the same shop', async () => {
    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    expect(WINDOW_CODE).not.toBe(REBOOK_CODE);
    expect(db.qr.get(WINDOW_CODE)!.placement).toBe('WINDOW');
    expect(db.qr.get(REBOOK_CODE)!.placement).toBe('REBOOK');
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe(
      (await scan(REBOOK_CODE)).headers.get('Location'),
    );
  });
});

describe('resolveQrDestination', () => {
  const s = { id: 'cmshop1', bookingSlug: 'blackline-barbers' };
  it('SETUP is unavailable; FREE uses the slug route', () => {
    expect(resolveQrDestination({ state: 'SETUP', shop: s })).toEqual({ kind: 'unavailable' });
    expect(resolveQrDestination({ state: 'FREE_BOOKING', shop: s })).toEqual({
      kind: 'redirect',
      path: '/book/blackline-barbers',
      source: 'free_booking_slug',
    });
  });
});
