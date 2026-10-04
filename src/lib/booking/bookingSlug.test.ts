import { describe, expect, it, vi } from 'vitest';
import {
  BOOKING_SLUG_ADVISORY_LOCK_KEY,
  RESERVED_BOOKING_SLUGS,
  bookingSlugCandidates,
  deterministicSlugSuffix,
  ensureShopBookingSlug,
  slugifyBookingName,
} from './bookingSlug';

type Row = { id: string; name: string; townCity: string | null; bookingSlug: string | null };

function fakeTx(rows: Row[]) {
  const calls: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      calls.push('row_lock');
      return [{ id: 'x' }];
    }),
    $executeRaw: vi.fn(async (_sql: { values: unknown[] }) => {
      calls.push('advisory_lock');
      return 1;
    }),
    shopSettings: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        return { ...row };
      }),
      findMany: vi.fn(async ({ where }: { where: { bookingSlug: { in: string[] } } }) =>
        rows
          .filter((r) => r.bookingSlug && where.bookingSlug.in.includes(r.bookingSlug))
          .map((r) => ({ bookingSlug: r.bookingSlug })),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { bookingSlug: string } }) => {
        calls.push('update');
        const row = rows.find((r) => r.id === where.id)!;
        row.bookingSlug = data.bookingSlug;
        return { ...row };
      }),
    },
  };
  return { tx: tx as never, raw: tx, calls };
}

describe('slugifyBookingName', () => {
  it('A: "Blackline Barbers" → blackline-barbers', () => {
    expect(slugifyBookingName('Blackline Barbers')).toBe('blackline-barbers');
  });

  it('B: normalises punctuation, repeated spaces, ampersands and accents', () => {
    expect(slugifyBookingName('John & Sons')).toBe('john-and-sons');
    expect(slugifyBookingName('  The   Fade--Room!!  ')).toBe('the-fade-room');
    expect(slugifyBookingName("Joe's Barbers, Est. 1999")).toBe('joes-barbers-est-1999');
    expect(slugifyBookingName('Café Crème Coiffure')).toBe('cafe-creme-coiffure');
    expect(slugifyBookingName('Łódź Straße')).toBe('lodz-strasse');
    expect(slugifyBookingName('A&B')).toBe('a-and-b');
    expect(slugifyBookingName('!!!')).toBe('');
  });

  it('truncates very long names at a word boundary', () => {
    const slug = slugifyBookingName('The Very Long Barbershop Name That Goes On And On Forever More');
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug).not.toMatch(/-$/);
  });
});

describe('bookingSlugCandidates', () => {
  it('orders name, name-town, then short deterministic suffixes without the raw id', () => {
    const shopId = 'cmabc123rawid';
    const candidates = bookingSlugCandidates({ shopId, name: 'Blackline Barbers', townCity: 'Bournemouth' });
    expect(candidates[0]).toBe('blackline-barbers');
    expect(candidates[1]).toBe('blackline-barbers-bournemouth');
    expect(candidates[2]).toMatch(/^blackline-barbers-[a-z2-9]{4}$/);
    expect(candidates.every((candidate) => !candidate.includes(shopId))).toBe(true);
    expect(bookingSlugCandidates({ shopId, name: 'Blackline Barbers', townCity: 'Bournemouth' })).toEqual(
      candidates,
    );
  });

  it('deterministic suffix is stable per shop and differs between shops', () => {
    expect(deterministicSlugSuffix('shop-a', 4)).toBe(deterministicSlugSuffix('shop-a', 4));
    expect(deterministicSlugSuffix('shop-a', 8)).not.toBe(deterministicSlugSuffix('shop-b', 8));
  });

  it('never offers reserved demo/system identifiers', () => {
    for (const name of ['demo-shop', 'Blackline Barbers Demo', 'Cancel', 'Kersivo']) {
      const candidates = bookingSlugCandidates({ shopId: 's1', name });
      expect(candidates.some((candidate) => RESERVED_BOOKING_SLUGS.has(candidate))).toBe(false);
    }
  });

  it('falls back to a generic base when the name has no usable characters', () => {
    expect(bookingSlugCandidates({ shopId: 's1', name: '***' })[0]).toBe('barbershop');
  });
});

describe('ensureShopBookingSlug', () => {
  it('allocates the clean name slug under the row lock and slug advisory lock', async () => {
    const rows: Row[] = [{ id: 's1', name: 'Blackline Barbers', townCity: null, bookingSlug: null }];
    const { tx, raw, calls } = fakeTx(rows);

    expect(await ensureShopBookingSlug(tx, 's1')).toBe('blackline-barbers');
    expect(rows[0]!.bookingSlug).toBe('blackline-barbers');
    expect(calls).toEqual(['row_lock', 'advisory_lock', 'update']);
    expect(raw.$executeRaw.mock.calls[0]![0].values).toContain(BOOKING_SLUG_ADVISORY_LOCK_KEY);
  });

  it('C: a shop that already has a slug keeps it unchanged (even after a rename)', async () => {
    const rows: Row[] = [{ id: 's1', name: 'Renamed Shop', townCity: 'Leeds', bookingSlug: 'blackline-barbers' }];
    const { tx, raw } = fakeTx(rows);

    expect(await ensureShopBookingSlug(tx, 's1')).toBe('blackline-barbers');
    expect(raw.shopSettings.update).not.toHaveBeenCalled();
    expect(raw.$executeRaw).not.toHaveBeenCalled();
  });

  it('D: name collision uses the town suffix when available', async () => {
    const rows: Row[] = [
      { id: 'other', name: 'Blackline Barbers', townCity: null, bookingSlug: 'blackline-barbers' },
      { id: 's1', name: 'Blackline Barbers', townCity: 'Bournemouth', bookingSlug: null },
    ];
    const { tx } = fakeTx(rows);

    expect(await ensureShopBookingSlug(tx, 's1')).toBe('blackline-barbers-bournemouth');
  });

  it('E: name + town collision falls back to a short deterministic suffix', async () => {
    const rows: Row[] = [
      { id: 'o1', name: 'x', townCity: null, bookingSlug: 'blackline-barbers' },
      { id: 'o2', name: 'x', townCity: null, bookingSlug: 'blackline-barbers-bournemouth' },
      { id: 's1', name: 'Blackline Barbers', townCity: 'Bournemouth', bookingSlug: null },
    ];
    const { tx } = fakeTx(rows);

    const slug = await ensureShopBookingSlug(tx, 's1');
    expect(slug).toBe(`blackline-barbers-${deterministicSlugSuffix('s1', 4)}`);
    expect(slug).toMatch(/^blackline-barbers-[a-z2-9]{4}$/);
    expect(slug).not.toContain('s1');
  });

  it('E: no town → name collision goes straight to the deterministic suffix', async () => {
    const rows: Row[] = [
      { id: 'o1', name: 'x', townCity: null, bookingSlug: 'john-and-sons' },
      { id: 's1', name: 'John & Sons', townCity: null, bookingSlug: null },
    ];
    const { tx } = fakeTx(rows);
    expect(await ensureShopBookingSlug(tx, 's1')).toBe(`john-and-sons-${deterministicSlugSuffix('s1', 4)}`);
  });
});
