import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  QR_CODE_LENGTH,
  QR_CODE_PATTERN,
  ensureShopQrCodes,
  generateOpaqueQrCode,
  normalizeQrCode,
} from './shopQrCodes';

vi.mock('../db/client', () => ({ prisma: {} }));

type QrRow = { id: string; shopId: string; code: string; placement: 'WINDOW' | 'REBOOK' };

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

function fakeDb(initial: QrRow[] = [], opts: { failCreateOnce?: boolean } = {}) {
  const rows = [...initial];
  let failNext = Boolean(opts.failCreateOnce);
  const lockedShops: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async (sql: { values: unknown[] }) => {
      lockedShops.push(String(sql.values[0]));
      return [{ id: sql.values[0] }];
    }),
    shopQrCode: {
      findMany: vi.fn(async ({ where }: { where: { shopId: string } }) =>
        rows.filter((r) => r.shopId === where.shopId).map((r) => ({ ...r })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) =>
        rows.find((r) => r.code === where.code) ? { id: 'clash' } : null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<QrRow, 'id'> }) => {
        if (failNext) {
          failNext = false;
          throw uniqueViolation();
        }
        if (rows.some((r) => r.code === data.code)) throw uniqueViolation();
        if (rows.some((r) => r.shopId === data.shopId && r.placement === data.placement)) {
          throw uniqueViolation();
        }
        const row = { id: `qr_${rows.length + 1}`, ...data };
        rows.push(row);
        return { ...row };
      }),
    },
  };
  // Simulate rollback: rows created inside a failed transaction are discarded.
  const db = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      const snapshot = rows.length;
      try {
        return await fn(tx);
      } catch (error) {
        rows.splice(snapshot);
        throw error;
      }
    }),
  };
  return { db: db as never, rawDb: db, tx, rows, lockedShops };
}

describe('generateOpaqueQrCode', () => {
  it('produces URL-safe opaque codes of the expected format', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateOpaqueQrCode()));
    expect(codes.size).toBe(500);
    for (const code of codes) {
      expect(code).toHaveLength(QR_CODE_LENGTH);
      expect(code).toMatch(QR_CODE_PATTERN);
      expect(encodeURIComponent(code)).toBe(code);
    }
  });

  it('normalises scanned codes and rejects anything outside the format', () => {
    const code = generateOpaqueQrCode();
    expect(normalizeQrCode(` ${code.toLowerCase()} `)).toBe(code);
    expect(normalizeQrCode('short')).toBeNull();
    expect(normalizeQrCode('../../etc/passwd')).toBeNull();
    expect(normalizeQrCode(`${code}0`)).toBeNull();
    expect(normalizeQrCode(undefined)).toBeNull();
  });
});

describe('ensureShopQrCodes', () => {
  it('T: creates exactly one WINDOW and one REBOOK code under the shop row lock', async () => {
    const { db, rows, lockedShops } = fakeDb();
    const result = await ensureShopQrCodes('cmshop123', { db });

    expect(result.map((row) => row.placement)).toEqual(['WINDOW', 'REBOOK']);
    expect(rows).toHaveLength(2);
    expect(lockedShops).toEqual(['cmshop123']);
  });

  it('U: repeating ensure returns the same rows without creating duplicates', async () => {
    const { db, rows, tx } = fakeDb();
    const first = await ensureShopQrCodes('cmshop123', { db });
    const second = await ensureShopQrCodes('cmshop123', { db });

    expect(second).toEqual(first);
    expect(rows).toHaveLength(2);
    expect(tx.shopQrCode.create).toHaveBeenCalledTimes(2);
  });

  it('only fills a missing placement', async () => {
    const { db, rows } = fakeDb([{ id: 'qr_w', shopId: 's1', code: 'WWWWWWWWWWWW', placement: 'WINDOW' }]);
    const result = await ensureShopQrCodes('s1', { db });

    expect(result[0]).toMatchObject({ id: 'qr_w', code: 'WWWWWWWWWWWW' });
    expect(result[1]!.placement).toBe('REBOOK');
    expect(rows).toHaveLength(2);
  });

  it('V: WINDOW and REBOOK receive different opaque codes', async () => {
    const { db } = fakeDb();
    const [window, rebook] = await ensureShopQrCodes('s1', { db });
    expect(window!.code).not.toBe(rebook!.code);
  });

  it('W: codes contain neither the shop id nor the normalised shop name', async () => {
    const shopId = 'cmblackline42';
    const { db } = fakeDb();
    const codes = (await ensureShopQrCodes(shopId, { db })).map((row) => row.code.toLowerCase());
    for (const code of codes) {
      expect(code).not.toContain(shopId);
      expect(code).not.toContain('blackline');
      expect(shopId).not.toContain(code);
    }
  });

  it('regenerates when a pre-checked code already exists on another shop', async () => {
    const taken = 'TAKENCODE234';
    const { db, rows } = fakeDb([{ id: 'other', shopId: 'other', code: taken, placement: 'WINDOW' }]);
    const sequence = [taken, 'FRESHCODE234', 'FRESHCODE567'];
    const result = await ensureShopQrCodes('s1', { db, generateCode: () => sequence.shift()! });

    expect(result.map((row) => row.code)).toEqual(['FRESHCODE234', 'FRESHCODE567']);
    expect(rows.filter((row) => row.shopId === 's1')).toHaveLength(2);
  });

  it('retries the whole transaction after a UNIQUE violation and never returns a foreign row', async () => {
    const { db, rawDb, rows } = fakeDb([], { failCreateOnce: true });
    const result = await ensureShopQrCodes('s1', { db });

    expect(rawDb.$transaction).toHaveBeenCalledTimes(2);
    expect(result.every((row) => row.shopId === 's1')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('rethrows non-unique errors without retrying', async () => {
    const { db, rawDb, tx } = fakeDb();
    tx.shopQrCode.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(ensureShopQrCodes('s1', { db })).rejects.toThrow('db down');
    expect(rawDb.$transaction).toHaveBeenCalledTimes(1);
  });
});
