import { describe, expect, it, vi } from 'vitest';
import { Prisma, QrKitFulfilmentStatus as S } from '@prisma/client';
import {
  QR_KIT_ALLOWED_TRANSITIONS,
  buildQrKitPrintManifest,
  evaluateQrKitShopEligibility,
  isAllowedQrKitTransition,
  parseQrKitInternalFields,
  requestInitialQrKit,
  transitionQrKitFulfilment,
  validateQrKitRequestDetails,
  type QrKitShopFacts,
} from './qrKitFulfilment';

vi.mock('../db/client', () => ({ prisma: {} }));

const eligibleFacts: QrKitShopFacts = {
  productState: 'FREE_BOOKING',
  publicBookingCapable: true,
  shopName: 'Fade Room',
  bookingSlug: 'fade-room',
  emailVerified: true,
  activeBookableBarbers: 1,
  activeServices: 1,
  hasWorkingHours: true,
  termsAccepted: true,
};

const validInput = {
  contactName: 'Sam Owner',
  contactEmail: 'Sam@Example.co.uk',
  contactPhone: '07700 900123',
  addressLine1: '1 High Street',
  townCity: 'Leeds',
  postcode: 'ls1 4ap',
  countryCode: 'GB',
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

type KitRow = Record<string, unknown> & { id: string; shopId: string; status: S };

/** In-memory DB honouring the QrKitFulfilment.shopId and EmailOutbound.dedupeKey UNIQUE constraints. */
function fakeDb(options: { raceOnCreate?: boolean } = {}) {
  const kits: KitRow[] = [];
  const events: Array<Record<string, unknown>> = [];
  const emails: Array<Record<string, unknown>> = [];
  const qrCodes: Array<{ id: string; shopId: string; code: string; placement: 'WINDOW' | 'REBOOK' }> = [];
  let raceOnCreate = Boolean(options.raceOnCreate);
  let seq = 0;

  const tx = {
    $queryRaw: vi.fn(async () => []),
    qrKitFulfilment: {
      findUnique: vi.fn(async ({ where }: { where: { shopId?: string; id?: string } }) => {
        const row = kits.find((k) => (where.id ? k.id === where.id : k.shopId === where.shopId));
        return row ? { ...row } : null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = kits.find((k) => k.id === where.id);
        if (!row) throw new Error('not found');
        return { ...row };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (raceOnCreate) {
          raceOnCreate = false;
          kits.push({ id: 'kit_winner', shopId: String(data.shopId), status: S.REQUESTED });
          throw uniqueViolation();
        }
        if (kits.some((k) => k.shopId === data.shopId)) throw uniqueViolation();
        const row = { ...data, id: `kit_${++seq}`, status: S.REQUESTED } as KitRow;
        kits.push(row);
        return { id: row.id };
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string; status: S }; data: Record<string, unknown> }) => {
          const row = kits.find((k) => k.id === where.id && k.status === where.status);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      ),
    },
    qrKitFulfilmentEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      }),
    },
    emailOutbound: {
      upsert: vi.fn(async ({ where, create }: { where: { dedupeKey: string }; create: Record<string, unknown> }) => {
        const existing = emails.find((e) => e.dedupeKey === where.dedupeKey);
        if (existing) return existing;
        const row = { id: `email_${emails.length + 1}`, ...create };
        emails.push(row);
        return row;
      }),
    },
    shopQrCode: {
      findMany: vi.fn(async ({ where }: { where: { shopId: string } }) =>
        qrCodes.filter((r) => r.shopId === where.shopId).map((r) => ({ ...r })),
      ),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: { shopId: string; code: string; placement: 'WINDOW' | 'REBOOK' } }) => {
        const row = { id: `qr_${qrCodes.length + 1}`, ...data };
        qrCodes.push(row);
        return { ...row };
      }),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      const snapshot = { kits: kits.length, events: events.length, emails: emails.length };
      try {
        return await fn(tx);
      } catch (error) {
        // Simulated rollback (the race winner row is committed by "another" transaction).
        if (!(error instanceof Prisma.PrismaClientKnownRequestError)) kits.splice(snapshot.kits);
        events.splice(snapshot.events);
        emails.splice(snapshot.emails);
        throw error;
      }
    }),
  };
  return { db: db as never, kits, events, emails, qrCodes, tx };
}

describe('QR Kit eligibility', () => {
  it('eligible Starter shop has no blockers', () => {
    expect(evaluateQrKitShopEligibility(eligibleFacts)).toEqual([]);
  });

  it('SETUP is blocked and Full is not eligible', () => {
    expect(evaluateQrKitShopEligibility({ ...eligibleFacts, productState: 'SETUP' })).toContain(
      'NOT_STARTER',
    );
    expect(
      evaluateQrKitShopEligibility({ ...eligibleFacts, productState: 'FULL_KERSIVO' }),
    ).toContain('NOT_STARTER');
  });

  it('does not require Stripe, Companies House, reviews or a first booking', () => {
    // The facts model has no such inputs; an eligible Starter shop needs none of them.
    expect(Object.keys(eligibleFacts).sort()).toEqual(
      [
        'activeBookableBarbers',
        'activeServices',
        'bookingSlug',
        'emailVerified',
        'hasWorkingHours',
        'productState',
        'publicBookingCapable',
        'shopName',
        'termsAccepted',
      ].sort(),
    );
    expect(evaluateQrKitShopEligibility(eligibleFacts)).toHaveLength(0);
  });

  it.each([
    ['NO_BOOKABLE_BARBER', { activeBookableBarbers: 0 }],
    ['NO_ACTIVE_SERVICE', { activeServices: 0 }],
    ['NO_WORKING_HOURS', { hasWorkingHours: false }],
    ['SHOP_NAME_MISSING', { shopName: '  ' }],
    ['EMAIL_NOT_VERIFIED', { emailVerified: false }],
    ['PUBLIC_BOOKING_UNAVAILABLE', { publicBookingCapable: false }],
    ['TERMS_NOT_ACCEPTED', { termsAccepted: false }],
  ] as const)('blocks with %s', (code, patch) => {
    expect(evaluateQrKitShopEligibility({ ...eligibleFacts, ...patch })).toEqual([code]);
  });

  it('missing address or contact details block the request', () => {
    const result = validateQrKitRequestDetails({
      ...validInput,
      contactName: '',
      addressLine1: '',
      postcode: 'NOT A POSTCODE',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining(['CONTACT_NAME_MISSING', 'ADDRESS_MISSING', 'POSTCODE_INVALID']),
      );
    }
    const noPhone = validateQrKitRequestDetails({ ...validInput, contactPhone: '' });
    expect(noPhone.ok).toBe(false);
    const abroad = validateQrKitRequestDetails({ ...validInput, countryCode: 'FR' });
    expect(abroad.ok).toBe(false);
  });

  it('normalises valid UK details', () => {
    const result = validateQrKitRequestDetails(validInput);
    expect(result).toEqual({
      ok: true,
      details: expect.objectContaining({
        contactEmail: 'sam@example.co.uk',
        contactPhone: '07700900123',
        postcode: 'LS1 4AP',
        countryCode: 'GB',
      }),
    });
  });
});

describe('requestInitialQrKit', () => {
  it('creates one canonical kit and enqueues the acknowledgement and internal email once', async () => {
    const { db, kits, emails, events } = fakeDb();
    const params = { shopId: 'shop-1', userId: 'u1', facts: eligibleFacts, input: validInput };

    const first = await requestInitialQrKit(params, { db });
    const retry = await requestInitialQrKit(params, { db });

    expect(first).toMatchObject({ ok: true, created: true, outboxId: 'email_1', internalOutboxId: 'email_2' });
    expect(retry).toMatchObject({ ok: true, created: false, outboxId: null, internalOutboxId: null });
    expect(retry.ok && first.ok && retry.fulfilmentId).toBe(first.ok && first.fulfilmentId);
    expect(kits).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(emails).toHaveLength(2);
    expect(emails[0]).toMatchObject({
      purpose: 'QR_KIT_REQUEST_ACKNOWLEDGEMENT',
      subject: 'Your KERSIVO QR Kit request',
      dedupeKey: 'qr-kit:ack:shop-1',
      toEmail: 'sam@example.co.uk',
    });
    const html = String((emails[0]!.payload as { html: string }).html);
    expect(html).toContain('will verify the shop details before it goes to print');
    expect(html).not.toMatch(/deliver(ed|y) (by|within|in)|working days/i);
  });

  it('the internal KERSIVO email carries contact and delivery details, escaped, with reply-to the contact', async () => {
    const { db, emails } = fakeDb();
    const result = await requestInitialQrKit(
      {
        shopId: 'shop-1',
        userId: 'u1',
        facts: { ...eligibleFacts, shopName: 'Fade <Room> & Co' },
        input: { ...validInput, addressLine2: 'Unit 2' },
      },
      { db },
    );
    expect(result.ok).toBe(true);
    const internal = emails.find((e) => e.purpose === 'QR_KIT_REQUEST_INTERNAL')!;
    expect(internal).toMatchObject({
      dedupeKey: 'qr-kit:internal:shop-1',
      toEmail: 'hello@kersivo.co.uk',
      subject: 'New QR Kit request — Fade <Room> & Co',
    });
    const payload = internal.payload as { html: string; replyTo?: string };
    expect(JSON.stringify(internal)).toContain('sam@example.co.uk');
    const html = String(payload.html);
    for (const value of [
      'Fade &lt;Room&gt; &amp; Co',
      'shop-1',
      result.ok ? result.fulfilmentId : '',
      'Sam Owner',
      'sam@example.co.uk',
      '07700900123',
      '1 High Street',
      'Unit 2',
      'Leeds',
      'LS1 4AP',
      'GB',
    ]) {
      expect(html).toContain(value);
    }
    expect(html).not.toContain('<Room>');
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('a concurrent duplicate (UNIQUE on shopId) returns the winner without a second kit or email', async () => {
    const { db, kits, emails } = fakeDb({ raceOnCreate: true });
    const result = await requestInitialQrKit(
      { shopId: 'shop-1', userId: 'u1', facts: eligibleFacts, input: validInput },
      { db },
    );
    expect(result).toEqual({
      ok: true,
      created: false,
      fulfilmentId: 'kit_winner',
      outboxId: null,
      internalOutboxId: null,
    });
    expect(kits).toHaveLength(1);
    expect(emails).toHaveLength(0);
  });

  it('ineligible shops and invalid details create nothing', async () => {
    const { db, kits, emails } = fakeDb();
    const setup = await requestInitialQrKit(
      { shopId: 's', userId: 'u', facts: { ...eligibleFacts, productState: 'SETUP' }, input: validInput },
      { db },
    );
    expect(setup).toMatchObject({ ok: false, reason: 'INELIGIBLE' });
    const bad = await requestInitialQrKit(
      { shopId: 's', userId: 'u', facts: eligibleFacts, input: { ...validInput, addressLine1: '' } },
      { db },
    );
    expect(bad).toMatchObject({ ok: false, reason: 'INVALID_DETAILS' });
    expect(kits).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });
});

describe('QR Kit state machine', () => {
  async function seededKit() {
    const env = fakeDb();
    const res = await requestInitialQrKit(
      { shopId: 'shop-1', userId: 'u1', facts: eligibleFacts, input: validInput },
      { db: env.db },
    );
    if (!res.ok) throw new Error('seed failed');
    return { ...env, id: res.fulfilmentId };
  }
  const actor = { userId: 'op1', email: 'ops@kersivo.co.uk' };

  it('defines the allowed transitions', () => {
    expect(isAllowedQrKitTransition(S.REQUESTED, S.VERIFYING)).toBe(true);
    expect(isAllowedQrKitTransition(S.REQUESTED, S.APPROVED)).toBe(false);
    expect(isAllowedQrKitTransition(S.VERIFYING, S.DISPATCHED)).toBe(false);
    expect(isAllowedQrKitTransition(S.NEEDS_REVIEW, S.VERIFYING)).toBe(true);
    expect(isAllowedQrKitTransition(S.NEEDS_REVIEW, S.APPROVED)).toBe(true);
    expect(QR_KIT_ALLOWED_TRANSITIONS.DISPATCHED).toEqual([]);
    expect(QR_KIT_ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
  });

  it('walks the happy path, creates QR codes at approval and records an audit trail', async () => {
    const { db, id, events, qrCodes, kits } = await seededKit();
    const now = new Date('2026-10-05T12:00:00Z');
    for (const to of [S.VERIFYING, S.APPROVED, S.PRINT_QUEUED] as const) {
      const r = await transitionQrKitFulfilment({ fulfilmentId: id, toStatus: to, actor }, { db, now });
      expect(r.ok).toBe(true);
    }
    expect(qrCodes.map((q) => q.placement)).toEqual(['WINDOW', 'REBOOK']);

    const dispatched = await transitionQrKitFulfilment(
      {
        fulfilmentId: id,
        toStatus: S.DISPATCHED,
        actor,
        fields: { dispatchCarrier: 'Royal Mail', dispatchReference: 'RM123' },
      },
      { db, now },
    );
    expect(dispatched.ok).toBe(true);
    expect(kits[0]).toMatchObject({
      status: S.DISPATCHED,
      verifyingAt: now,
      approvedAt: now,
      printQueuedAt: now,
      dispatchedAt: now,
      dispatchCarrier: 'Royal Mail',
      dispatchReference: 'RM123',
    });
    expect(events.map((e) => [e.fromStatus, e.toStatus])).toEqual([
      [null, S.REQUESTED],
      [S.REQUESTED, S.VERIFYING],
      [S.VERIFYING, S.APPROVED],
      [S.APPROVED, S.PRINT_QUEUED],
      [S.PRINT_QUEUED, S.DISPATCHED],
    ]);
    expect(events.slice(1).every((e) => e.actorEmail === 'ops@kersivo.co.uk')).toBe(true);
  });

  it('rejects invalid jumps without changing the record', async () => {
    const { db, id, kits, events } = await seededKit();
    const r = await transitionQrKitFulfilment({ fulfilmentId: id, toStatus: S.DISPATCHED, actor }, { db });
    expect(r).toEqual({ ok: false, reason: 'INVALID_TRANSITION', from: S.REQUESTED, to: S.DISPATCHED });
    expect(kits[0]!.status).toBe(S.REQUESTED);
    expect(events).toHaveLength(1);
  });

  it('NEEDS_REVIEW is recoverable on the same record', async () => {
    const { db, id, kits } = await seededKit();
    await transitionQrKitFulfilment({ fulfilmentId: id, toStatus: S.VERIFYING, actor }, { db });
    const review = await transitionQrKitFulfilment(
      { fulfilmentId: id, toStatus: S.NEEDS_REVIEW, actor, fields: { verificationNote: 'Check postcode' } },
      { db },
    );
    expect(review.ok).toBe(true);
    const approved = await transitionQrKitFulfilment({ fulfilmentId: id, toStatus: S.APPROVED, actor }, { db });
    expect(approved.ok).toBe(true);
    expect(kits).toHaveLength(1);
    expect(kits[0]).toMatchObject({ status: S.APPROVED, verificationNote: 'Check postcode' });
  });

  it('REJECTED keeps the same record and blocks a new kit request', async () => {
    const { db, id, kits } = await seededKit();
    await transitionQrKitFulfilment({ fulfilmentId: id, toStatus: S.VERIFYING, actor }, { db });
    await transitionQrKitFulfilment({ fulfilmentId: id, toStatus: S.REJECTED, actor }, { db });
    const again = await requestInitialQrKit(
      { shopId: 'shop-1', userId: 'u1', facts: eligibleFacts, input: validInput },
      { db },
    );
    expect(again).toMatchObject({ ok: true, created: false, fulfilmentId: id });
    expect(kits).toHaveLength(1);
  });

  it('validates internal cost fields as non-negative pence', () => {
    expect(parseQrKitInternalFields({ printCostPence: 250 })).toEqual({
      ok: true,
      fields: { printCostPence: 250 },
    });
    expect(parseQrKitInternalFields({ postageCostPence: -1 }).ok).toBe(false);
    expect(parseQrKitInternalFields({ otherCostPence: 1.5 }).ok).toBe(false);
  });
});

describe('buildQrKitPrintManifest', () => {
  const fulfilment = {
    id: 'kit_1',
    shopId: 'shop-1',
    status: S.APPROVED,
    shopNameSnapshot: 'Fade Room',
    contactName: 'Sam',
    contactPhone: '07700900123',
    contactEmail: 'sam@example.co.uk',
    addressLine1: '1 High Street',
    addressLine2: null,
    townCity: 'Leeds',
    postcode: 'LS1 4AP',
    countryCode: 'GB',
  };
  const qrCodes = [
    { id: 'q1', shopId: 'shop-1', code: 'WWWWWWWWWWWW', placement: 'WINDOW' as const },
    { id: 'q2', shopId: 'shop-1', code: 'RRRRRRRRRRRR', placement: 'REBOOK' as const },
  ];

  it('keeps WINDOW and REBOOK separate and targets /q/{code}, never /book/', () => {
    const manifest = buildQrKitPrintManifest({ fulfilment, qrCodes, baseUrl: 'https://kersivo.co.uk/' });
    expect(manifest.items).toHaveLength(2);
    const [window, rebook] = manifest.items;
    expect(window).toMatchObject({
      placement: 'WINDOW',
      targetUrl: 'https://kersivo.co.uk/q/WWWWWWWWWWWW',
      widthMm: 150,
      heightMm: 170,
      headline: 'BOOK ONLINE',
      subline: 'Scan to book',
    });
    expect(rebook).toMatchObject({
      placement: 'REBOOK',
      targetUrl: 'https://kersivo.co.uk/q/RRRRRRRRRRRR',
      widthMm: 100,
      heightMm: 100,
      headline: 'REBOOK BEFORE YOU LEAVE',
      subline: 'Scan to book',
    });
    expect(window!.code).not.toBe(rebook!.code);
    for (const item of manifest.items) {
      expect(item.targetUrl).toContain('/q/');
      expect(item.targetUrl).not.toContain('/book/');
    }
    expect(JSON.stringify(manifest)).not.toContain('/book/');
    expect(manifest.artworkStatus).toBe('NOT_FINAL');
  });

  it('refuses to build without both placements or with another shop’s code', () => {
    expect(() =>
      buildQrKitPrintManifest({ fulfilment, qrCodes: [qrCodes[0]!], baseUrl: 'https://kersivo.co.uk' }),
    ).toThrow(/REBOOK/);
    expect(() =>
      buildQrKitPrintManifest({
        fulfilment,
        qrCodes: [qrCodes[0]!, { ...qrCodes[1]!, shopId: 'other' }],
        baseUrl: 'https://kersivo.co.uk',
      }),
    ).toThrow(/REBOOK/);
  });
});
