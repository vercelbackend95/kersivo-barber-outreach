import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadKersivoAccess = vi.fn();
vi.mock('./kersivoAccess', () => ({
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));
vi.mock('../db/client', () => ({ prisma: {} }));

import {
  hasAllFullDestinationAttestations,
  invalidateFullBookingDestination,
  loadFullBookingDestinationForState,
  verifyFullBookingDestination,
} from './fullBookingDestination';

type Row = {
  shopId: string;
  status: 'VERIFIED_LIVE' | 'INVALIDATED';
  url: string;
  verifiedAt: Date;
  verificationMethod: string;
  verifiedByUserId: string | null;
  verifiedByEmail: string | null;
  siteVersion: string | null;
  invalidatedAt: Date | null;
  invalidationReason: string | null;
};

const NOW = new Date('2026-10-05T12:00:00.000Z');
const OWN = 'https://examplebarbers.co.uk/book';
const actor = { userId: 'op-1', email: 'Ops@Kersivo.co.uk' };

function makeDb(shops: string[] = ['shop-1']) {
  const rows = new Map<string, Row>();
  const events: Array<Record<string, unknown>> = [];
  const pick = (row: Row) => ({ ...row, id: `fbd-${row.shopId}` });
  const db = {
    rows,
    events,
    $queryRaw: vi.fn(async () => []),
    shopSettings: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        shops.includes(where.id) ? { id: where.id } : null,
      ),
    },
    fullBookingDestination: {
      findUnique: vi.fn(async ({ where }: { where: { shopId: string } }) => {
        const row = rows.get(where.shopId);
        return row ? pick(row) : null;
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        rows.set(data.shopId, { ...data });
        return { ...data };
      }),
      update: vi.fn(async ({ where, data }: { where: { shopId: string }; data: Partial<Row> }) => {
        const next = { ...rows.get(where.shopId)!, ...data };
        rows.set(where.shopId, next);
        return { ...next };
      }),
      delete: vi.fn(),
    },
    fullBookingDestinationEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      }),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db));
  return db;
}

const verify = (db: ReturnType<typeof makeDb>, overrides: Record<string, unknown> = {}) =>
  verifyFullBookingDestination({ shopId: 'shop-1', url: OWN, actor, now: NOW, db: db as never, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  loadKersivoAccess.mockResolvedValue({ state: 'FULL_KERSIVO', capabilities: [] });
});

describe('verifyFullBookingDestination (OPS attestation)', () => {
  it('12: an authorised OPS verification of a valid Full shop URL is stored and audited', async () => {
    const db = makeDb();
    const result = await verify(db, { siteVersion: 'v7' });
    expect(result).toMatchObject({ ok: true, outcome: 'verified', destination: { url: OWN, status: 'VERIFIED_LIVE' } });
    expect(db.rows.get('shop-1')).toMatchObject({
      url: OWN,
      verifiedAt: NOW,
      verificationMethod: 'OPS_MANUAL_ATTESTATION',
      verifiedByUserId: 'op-1',
      verifiedByEmail: 'ops@kersivo.co.uk',
      siteVersion: 'v7',
    });
    expect(db.events).toEqual([
      expect.objectContaining({ shopId: 'shop-1', action: 'VERIFIED', url: OWN, previousUrl: null, actorEmail: 'ops@kersivo.co.uk' }),
    ]);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(loadKersivoAccess).toHaveBeenCalledWith('shop-1', NOW, db);
  });

  it('22: repeating the same verification is idempotent (no write, no new audit row)', async () => {
    const db = makeDb();
    await verify(db);
    const again = await verify(db, { url: 'https://EXAMPLEBARBERS.co.uk/book' });
    expect(again).toMatchObject({ ok: true, outcome: 'already_verified' });
    expect(db.fullBookingDestination.create).toHaveBeenCalledTimes(1);
    expect(db.fullBookingDestination.update).not.toHaveBeenCalled();
    expect(db.events).toHaveLength(1);
  });

  it('23: changing the verified URL needs explicit replaceExisting and is audited as URL_CHANGED', async () => {
    const db = makeDb();
    await verify(db);
    const next = 'https://examplebarbers.co.uk/appointments';
    expect(await verify(db, { url: next })).toEqual({ ok: false, reason: 'URL_CHANGE_NOT_CONFIRMED' });
    expect(db.rows.get('shop-1')!.url).toBe(OWN);

    expect(await verify(db, { url: next, replaceExisting: true })).toMatchObject({ ok: true, outcome: 'url_changed' });
    expect(db.rows.get('shop-1')!.url).toBe(next);
    expect(db.events.at(-1)).toMatchObject({ action: 'URL_CHANGED', url: next, previousUrl: OWN });
  });

  it.each([
    ['http://examplebarbers.co.uk/book', 'HTTPS_REQUIRED'],
    ['https://localhost/book', 'LOCAL_HOST_NOT_ALLOWED'],
    ['https://192.168.0.2/book', 'IP_HOST_NOT_ALLOWED'],
    ['https://a:b@examplebarbers.co.uk/book', 'CREDENTIALS_NOT_ALLOWED'],
    ['https://examplebarbers.co.uk/book#x', 'FRAGMENT_NOT_ALLOWED'],
    ['https://examplebarbers.co.uk/q/H7K3PX9M2QAB', 'QR_PATH_NOT_ALLOWED'],
    ['https://shop-git-main.vercel.app/book', 'PREVIEW_HOST_NOT_ALLOWED'],
    ['https://kersivo.co.uk/book/example', 'KERSIVO_HOST_NOT_ALLOWED'],
  ])('13–20: %s is refused before any DB write (%s)', async (url, code) => {
    const db = makeDb();
    expect(await verify(db, { url })).toEqual({ ok: false, reason: 'INVALID_URL', code });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.rows.size).toBe(0);
  });

  it('only Full KERSIVO shops can be verified (paid Full is checked inside the shop lock)', async () => {
    for (const state of ['FREE_BOOKING', 'SETUP']) {
      loadKersivoAccess.mockResolvedValue({ state, capabilities: [] });
      const db = makeDb();
      expect(await verify(db)).toEqual({ ok: false, reason: 'NOT_FULL' });
      expect(db.rows.size).toBe(0);
      expect(db.events).toHaveLength(0);
    }
  });

  it('demo / showcase shops can never acquire a production destination', async () => {
    const db = makeDb(['cmdemo']);
    const { DEMO_SHOP_ID } = await import('../db/shopScope');
    expect(await verify(db, { shopId: DEMO_SHOP_ID })).toEqual({ ok: false, reason: 'PROTECTED_SHOP' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('an unknown shop id is refused', async () => {
    const db = makeDb([]);
    expect(await verify(db, { shopId: 'nope' })).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('the record is scoped to exactly the verified shop', async () => {
    const db = makeDb(['shop-1', 'shop-2']);
    await verify(db);
    expect(db.rows.has('shop-2')).toBe(false);
    expect(await loadFullBookingDestinationForState('shop-2', 'FULL_KERSIVO', db as never)).toBeNull();
  });
});

describe('invalidateFullBookingDestination', () => {
  it('24: invalidation is explicit, audited and keeps the record + history', async () => {
    const db = makeDb();
    await verify(db);
    expect(await invalidateFullBookingDestination({ shopId: 'shop-1', reason: '', actor, db: db as never })).toEqual({
      ok: false,
      reason: 'REASON_REQUIRED',
    });

    const result = await invalidateFullBookingDestination({
      shopId: 'shop-1',
      reason: 'DNS moved away from KERSIVO',
      actor,
      now: NOW,
      db: db as never,
    });
    expect(result).toEqual({ ok: true, outcome: 'invalidated' });
    expect(db.rows.get('shop-1')).toMatchObject({
      status: 'INVALIDATED',
      url: OWN,
      invalidatedAt: NOW,
      invalidationReason: 'DNS moved away from KERSIVO',
    });
    expect(db.events.map((e) => e.action)).toEqual(['VERIFIED', 'INVALIDATED']);
    expect(db.fullBookingDestination.delete).not.toHaveBeenCalled();
    expect(db.fullBookingDestinationEvent.deleteMany).not.toHaveBeenCalled();

    expect(
      await invalidateFullBookingDestination({ shopId: 'shop-1', reason: 'again', actor, db: db as never }),
    ).toEqual({ ok: true, outcome: 'already_invalidated' });
    expect(db.events).toHaveLength(2);
  });

  it('re-verifying after invalidation is audited and makes the record authoritative again', async () => {
    const db = makeDb();
    await verify(db);
    await invalidateFullBookingDestination({ shopId: 'shop-1', reason: 'down', actor, db: db as never });
    expect(await verify(db)).toMatchObject({ ok: true, outcome: 'reverified' });
    expect(db.rows.get('shop-1')).toMatchObject({ status: 'VERIFIED_LIVE', invalidatedAt: null, invalidationReason: null });
  });

  it('invalidating a shop without a record is NOT_FOUND', async () => {
    const db = makeDb();
    expect(await invalidateFullBookingDestination({ shopId: 'shop-1', reason: 'x', actor, db: db as never })).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });
});

describe('loadFullBookingDestinationForState', () => {
  it('never reads the record outside Full KERSIVO', async () => {
    const db = makeDb();
    for (const state of ['FREE_BOOKING', 'SETUP'] as const) {
      expect(await loadFullBookingDestinationForState('shop-1', state, db as never)).toBeNull();
    }
    expect(db.fullBookingDestination.findUnique).not.toHaveBeenCalled();
  });
});

describe('hasAllFullDestinationAttestations', () => {
  it('requires every OPS check to be explicitly true', () => {
    const all = {
      dnsPointsCorrectly: true,
      httpsWorks: true,
      liveSiteReachable: true,
      correctShopLocation: true,
      bookingFlowReachable: true,
    };
    expect(hasAllFullDestinationAttestations(all)).toBe(true);
    expect(hasAllFullDestinationAttestations({ ...all, bookingFlowReachable: 'yes' })).toBe(false);
    expect(hasAllFullDestinationAttestations({ ...all, httpsWorks: undefined })).toBe(false);
    expect(hasAllFullDestinationAttestations(null)).toBe(false);
  });
});
