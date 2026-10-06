import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { resolveQrDestination } from '@/lib/qr/qrDestination';

type ShopRow = {
  id: string;
  bookingSlug: string | null;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  freeBookingActivatedAt: Date | null;
  sitePreviewUrl?: string | null;
  sitePreviewReadyAt?: Date | null;
  launchApprovedAt?: Date | null;
  launchApprovedVersion?: string | null;
  goLiveAt?: Date | null;
};

type DestinationRow = { shopId: string; status: 'VERIFIED_LIVE' | 'INVALIDATED'; url: string };

const db = vi.hoisted(() => ({
  qr: new Map<string, { shopId: string; placement: 'WINDOW' | 'REBOOK' }>(),
  shops: new Map<string, ShopRow>(),
  subscription: null as null | Record<string, unknown>,
  destinations: new Map<string, DestinationRow>(),
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
    fullBookingDestination: {
      findUnique: vi.fn(async ({ where }: { where: { shopId: string } }) => {
        const row = db.destinations.get(where.shopId);
        return row ? { ...row } : null;
      }),
    },
  },
}));

import { GET } from './[code]';

const WINDOW_CODE = 'H7K3PX9M2QAB';
const REBOOK_CODE = 'R4BKZ8N2W6CD';
const OWN_DOMAIN = 'https://blacklinebarbers.co.uk/book';
const ACTIVE_FULL = { status: 'ACTIVE', currentPeriodEnd: new Date('2999-01-01') };

function scan(code: string, url = `https://kersivo.test/q/${code}`) {
  return GET({ params: { code }, request: new Request(url), url: new URL(url) } as unknown as APIContext);
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

function verified(shopId = 'cmshop1', url = OWN_DOMAIN): DestinationRow {
  return { shopId, status: 'VERIFIED_LIVE', url };
}

function expectQrHeaders(res: Response) {
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
}

describe('GET /q/{code}', () => {
  beforeEach(() => {
    db.qr.clear();
    db.shops.clear();
    db.destinations.clear();
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

  it('27: a Starter shop gets a temporary redirect to /book/{slug}', async () => {
    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('a Full → Starter shop with paused intake keeps the stable /book/{slug} (the page enforces the pause)', async () => {
    db.shops.set('cmshop1', {
      ...shop(),
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectDisconnectedAt: new Date(),
    } as ShopRow);
    db.subscription = {
      status: 'CANCELED',
      currentPeriodEnd: new Date('2026-01-01'),
      cancelAtPeriodEnd: false,
      postFullPlan: 'STARTER',
    };
    db.destinations.set('cmshop1', verified());
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('Starter never uses a stored own-domain destination', async () => {
    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    db.destinations.set('cmshop1', verified());
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('28 + A: Full without a verified destination uses the hosted slug fallback', async () => {
    db.shops.set('cmshop1', shop());
    db.subscription = ACTIVE_FULL;
    const res = await scan(REBOOK_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('AA: a legacy Full shop without a slug falls back to its legacy booking route', async () => {
    db.shops.set('cmshop1', shop({ bookingSlug: null, shopPaidAt: new Date('2026-01-01') }));
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/cmshop1');
  });

  it('29 + 32–34: Full with a verified destination redirects to the exact own-domain URL (302, no-store, noindex)', async () => {
    db.shops.set('cmshop1', shop());
    db.subscription = ACTIVE_FULL;
    db.destinations.set('cmshop1', verified());
    for (const code of [WINDOW_CODE, REBOOK_CODE]) {
      const res = await scan(code);
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(OWN_DOMAIN);
      expectQrHeaders(res);
    }
  });

  it('B + C: site preview / launch approval / goLiveAt alone never switch the Full QR', async () => {
    db.shops.set(
      'cmshop1',
      shop({
        sitePreviewUrl: 'https://blackline-preview.vercel.app',
        sitePreviewReadyAt: new Date('2026-09-01'),
        launchApprovedAt: new Date('2026-09-02'),
        launchApprovedVersion: 'v3',
        goLiveAt: new Date('2026-09-02'),
      }),
    );
    db.subscription = ACTIVE_FULL;
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('31: an invalidated Full destination falls back to the hosted route (QR stays usable)', async () => {
    db.shops.set('cmshop1', shop());
    db.subscription = ACTIVE_FULL;
    db.destinations.set('cmshop1', { ...verified(), status: 'INVALIDATED' });
    const res = await scan(WINDOW_CODE);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('23: another shop’s verified destination never resolves for this shop’s QR', async () => {
    db.shops.set('cmshop1', shop());
    db.subscription = ACTIVE_FULL;
    db.destinations.set('cmshop1', verified('cmshop2', 'https://othershop.co.uk/book'));
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('35: no open redirect — request query params never influence the Location', async () => {
    db.shops.set('cmshop1', shop());
    db.subscription = ACTIVE_FULL;
    const res = await scan(
      WINDOW_CODE,
      `https://kersivo.test/q/${WINDOW_CODE}?next=https://evil.example&url=https://evil.example&redirect=//evil.example`,
    );
    expect(res.headers.get('Location')).toBe('/book/blackline-barbers');
  });

  it('25 + 26 + 30 + 44–46: the same WINDOW / REBOOK codes follow Starter → Full → verified → Starter', async () => {
    const codesBefore = [...db.qr.keys()];

    db.shops.set('cmshop1', shop({ freeBookingActivatedAt: new Date('2026-10-01') }));
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');

    // Starter → Full: paid but not verified live yet → hosted, no broken window.
    db.subscription = ACTIVE_FULL;
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');

    // OPS verifies → same codes switch automatically.
    db.destinations.set('cmshop1', verified());
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe(OWN_DOMAIN);
    expect((await scan(REBOOK_CODE)).headers.get('Location')).toBe(OWN_DOMAIN);

    // Full → Starter: the record stays for audit but is ignored.
    db.subscription = { status: 'CANCELED', currentPeriodEnd: new Date('2000-01-01'), postFullPlan: 'STARTER' };
    expect((await scan(WINDOW_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');
    expect((await scan(REBOOK_CODE)).headers.get('Location')).toBe('/book/blackline-barbers');
    expect(db.destinations.get('cmshop1')).toEqual(verified());

    expect([...db.qr.keys()]).toEqual(codesBefore);
  });

  it('AB: Full ending without a Starter choice opens no booking flow', async () => {
    db.shops.set('cmshop1', shop());
    db.destinations.set('cmshop1', verified());
    db.subscription = { status: 'CANCELED', currentPeriodEnd: new Date('2000-01-01'), postFullPlan: 'CHOICE_REQUIRED' };
    expect((await scan(WINDOW_CODE)).status).toBe(404);
  });

  it('47 + H: a departed shop keeps its QR records but /q opens nothing, even with a stored Full destination', async () => {
    db.destinations.set('cmshop1', verified());
    for (const status of ['WINDING_DOWN', 'RETENTION']) {
      db.shops.set('cmshop1', {
        ...shop({ freeBookingActivatedAt: new Date('2026-10-01') }),
        departure: { status },
      } as ShopRow);
      db.subscription = { status: 'CANCELED', currentPeriodEnd: new Date('2000-01-01'), postFullPlan: 'LEAVE' };
      const res = await scan(WINDOW_CODE);
      expect(res.status).toBe(404);
      expect(res.headers.get('Location')).toBeNull();
      expectQrHeaders(res);
    }
    expect(db.qr.size).toBe(2);
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
  it('SETUP is unavailable; Starter uses the slug route', () => {
    expect(resolveQrDestination({ state: 'SETUP', shop: s, fullDestination: verified() })).toEqual({
      kind: 'unavailable',
    });
    expect(resolveQrDestination({ state: 'FREE_BOOKING', shop: s })).toEqual({
      kind: 'redirect',
      path: '/book/blackline-barbers',
      source: 'free_booking_slug',
    });
  });

  it('Full: hosted fallback until verified, then the external verified URL only', () => {
    expect(resolveQrDestination({ state: 'FULL_KERSIVO', shop: s })).toEqual({
      kind: 'redirect',
      path: '/book/blackline-barbers',
      source: 'full_kersivo_hosted_fallback',
    });
    expect(resolveQrDestination({ state: 'FULL_KERSIVO', shop: s, fullDestination: verified() })).toEqual({
      kind: 'external_redirect',
      url: OWN_DOMAIN,
      source: 'full_verified_own_domain',
    });
  });

  it('a stored record that would not pass validation today is never used as a redirect', () => {
    for (const url of ['http://blacklinebarbers.co.uk/book', 'https://evil.vercel.app', 'https://kersivo.co.uk/q/ABC']) {
      expect(
        resolveQrDestination({ state: 'FULL_KERSIVO', shop: s, fullDestination: verified('cmshop1', url) }).kind,
      ).toBe('redirect');
    }
  });
});
