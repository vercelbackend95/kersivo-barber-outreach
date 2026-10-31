import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> & { id: string; status: string };

const state: { rows: Row[]; shop: Record<string, unknown> | null; liveSubscriptions: number; flag: boolean } = {
  rows: [],
  shop: null,
  liveSubscriptions: 0,
  flag: true,
};
const enqueueEmail = vi.fn(async (..._args: unknown[]) => ({ id: 'outbox_1' }));
const tryDeliverOutboxEmail = vi.fn();
const purgeShopData = vi.fn();
const deleteOutbox = vi.fn();
const deleteEvents = vi.fn();
const deleteCheckouts = vi.fn();
const createEvent = vi.fn();
const suppress = vi.fn();

function matches(row: Row, where: Record<string, any>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (cond && typeof cond === 'object' && 'in' in cond) {
      if (!cond.in.includes(row[key])) return false;
    } else if (cond && typeof cond === 'object' && 'gt' in cond) {
      if (!((row[key] as Date) > cond.gt)) return false;
    } else if (cond && typeof cond === 'object' && 'lte' in cond) {
      if (!((row[key] as Date) <= cond.lte)) return false;
    } else if (cond === null) {
      if (row[key] != null) return false;
    } else if (row[key] !== cond) {
      return false;
    }
  }
  return true;
}

const db: any = {
  $queryRaw: vi.fn(),
  $transaction: (fn: (t: unknown) => unknown) => fn(db),
  previewRequest: {
    findMany: vi.fn(async () => state.rows),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.rows.find((r) => r.id === where.id) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, unknown> }) => {
      const hit = state.rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = state.rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    }),
  },
  previewRequestEvent: { create: (...a: unknown[]) => createEvent(...a), deleteMany: (...a: unknown[]) => deleteEvents(...a) },
  previewHubAsset: {
    findMany: vi.fn(async () => []),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  previewHubMessage: {
    updateMany: vi.fn(async () => ({ count: 0 })),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  previewChangeRequest: {
    updateMany: vi.fn(async () => ({ count: 0 })),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  previewContentReview: {
    updateMany: vi.fn(async () => ({ count: 0 })),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  emailOutbound: { deleteMany: (...a: unknown[]) => deleteOutbox(...a) },
  saasSubscription: {
    count: vi.fn(async () => state.liveSubscriptions),
    deleteMany: (...a: unknown[]) => deleteCheckouts(...a),
  },
  shopSettings: { findUnique: vi.fn(async () => state.shop), update: vi.fn(async () => ({})) },
};

vi.mock('@/lib/db/client', () => ({
  get prisma() {
    return db;
  },
}));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
  tryDeliverOutboxEmail: (...a: unknown[]) => tryDeliverOutboxEmail(...a),
}));
vi.mock('@/lib/setup/purgeShopData', () => ({
  beginShopPurgeGate: vi.fn(async () => ({ alreadyStarted: false })),
  listPrivateBlobPathsForShopPurge: vi.fn(async () => []),
  listPublicBlobUrlsForShopPurge: vi.fn(async () => []),
  deletePrivateBlobPathsBestEffort: vi.fn(),
  runPostCommitPublicBlobCleanup: vi.fn(),
  purgeShopData: (...a: unknown[]) => purgeShopData(...a),
}));
vi.mock('@/lib/preview/shopPreviewSession', () => ({
  mintPreviewToken: () => 'new-token',
  hashPreviewToken: () => 'new-hash',
}));
vi.mock('@/lib/setup/siteUrl', () => ({ getPublicSiteUrl: () => 'https://kersivo.co.uk' }));
vi.mock('./followups', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./followups')>()),
  suppressPendingPreviewFollowups: (...a: unknown[]) => suppress(...a),
}));
vi.mock('./config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config')>()),
  isFreePreviewFlowEnabled: () => state.flag,
}));

import {
  expireDuePreviews,
  isExpiryReminderDue,
  isFollowupDue,
  purgeExpiredPreviewData,
  runFreePreviewLifecycle,
  sendDuePreviewFollowups,
} from './lifecycle';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-12-01T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

function ready(overrides: Partial<Row> = {}): Row {
  return {
    id: 'req_1',
    status: 'READY',
    email: 'owner@example.com',
    firstName: 'Sam',
    shopName: 'Sharp Cuts',
    publicToken: 'A'.repeat(43),
    emailOptOut: false,
    previewReadyAt: daysAgo(3),
    expiresAt: new Date(daysAgo(3).getTime() + 30 * DAY),
    followupSentAt: null,
    expiryReminderSentAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.shop = { ownerUserId: null, shopPaidAt: null };
  state.liveSubscriptions = 0;
  state.flag = true;
});

describe('follow-up rules', () => {
  const row = ready() as any;

  it('E5 is due from 3 days after ready, not before', () => {
    expect(isFollowupDue(row, NOW)).toBe(true);
    expect(isFollowupDue({ ...row, previewReadyAt: daysAgo(2) }, NOW)).toBe(false);
  });

  it('E6 is due from 7 days before expiry, not before', () => {
    expect(isExpiryReminderDue(row, NOW)).toBe(false);
    expect(isExpiryReminderDue({ ...row, expiresAt: new Date(NOW.getTime() + 7 * DAY) }, NOW)).toBe(true);
  });

  it('E5 gives way to E6 when a late run finds both due', () => {
    const late = { ...row, previewReadyAt: daysAgo(25), expiresAt: new Date(NOW.getTime() + 5 * DAY) };
    expect(isExpiryReminderDue(late, NOW)).toBe(true);
    expect(isFollowupDue(late, NOW)).toBe(false);
  });

  it.each(['CONVERTED', 'DECLINED', 'REJECTED', 'EXPIRED', 'CHANGES_REQUESTED', 'REQUESTED', 'IN_PROGRESS'])(
    'sends neither email in status %s',
    (status) => {
      const expiring = { ...row, status, expiresAt: new Date(NOW.getTime() + DAY) };
      expect(isFollowupDue({ ...row, status }, NOW)).toBe(false);
      expect(isExpiryReminderDue(expiring, NOW)).toBe(false);
    },
  );

  it('sends neither email after opt-out, after the expiry date, or twice', () => {
    expect(isFollowupDue({ ...row, emailOptOut: true }, NOW)).toBe(false);
    expect(isFollowupDue({ ...row, followupSentAt: NOW }, NOW)).toBe(false);
    const expiring = { ...row, expiresAt: new Date(NOW.getTime() + DAY) };
    expect(isExpiryReminderDue({ ...expiring, emailOptOut: true }, NOW)).toBe(false);
    expect(isExpiryReminderDue({ ...expiring, expiryReminderSentAt: NOW }, NOW)).toBe(false);
    expect(isExpiryReminderDue({ ...row, expiresAt: daysAgo(1) }, NOW)).toBe(false);
  });
});

describe('sendDuePreviewFollowups', () => {
  it('queues E5 once, logs it, and links preview + no-thanks', async () => {
    state.rows = [ready()];
    expect(await sendDuePreviewFollowups(NOW)).toEqual({ followups: 1, expiryReminders: 0 });
    const input = enqueueEmail.mock.calls[0]![1] as Record<string, string>;
    expect(input.purpose).toBe('FREE_PREVIEW_FOLLOWUP');
    expect(input.dedupeKey).toBe('free-preview:followup:req_1');
    expect(input.subject).toBe('Had a chance to look at your Sharp Cuts preview?');
    expect(input.html).toContain(`/preview/${'A'.repeat(43)}"`);
    expect(input.html).toContain(`/preview/${'A'.repeat(43)}/no-thanks">Click here</a>`);
    expect(createEvent.mock.calls[0]![0].data.action).toBe('FOLLOWUP_SENT');
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('outbox_1');

    // A second run sees followupSentAt and sends nothing.
    expect(await sendDuePreviewFollowups(NOW)).toEqual({ followups: 0, expiryReminders: 0 });
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('queues E6 with the expiry date', async () => {
    state.rows = [ready({ previewReadyAt: daysAgo(24), expiresAt: new Date(NOW.getTime() + 6 * DAY), followupSentAt: daysAgo(21) })];
    expect(await sendDuePreviewFollowups(NOW)).toEqual({ followups: 0, expiryReminders: 1 });
    const input = enqueueEmail.mock.calls[0]![1] as Record<string, string>;
    expect(input.purpose).toBe('FREE_PREVIEW_EXPIRY_REMINDER');
    expect(input.subject).toBe('Your Sharp Cuts preview expires on 7 December 2026');
  });

  it('does not send when the owner declined between the read and the claim', async () => {
    const row = ready();
    state.rows = [row];
    db.previewRequest.findMany.mockImplementationOnce(async () => {
      const snapshot = { ...row };
      row.status = 'DECLINED';
      return [snapshot];
    });
    expect(await sendDuePreviewFollowups(NOW)).toEqual({ followups: 0, expiryReminders: 0 });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe('expireDuePreviews', () => {
  it('sets EXPIRED, logs it and stops queued follow-ups', async () => {
    state.rows = [ready({ expiresAt: daysAgo(1) })];
    db.previewRequest.findMany.mockImplementationOnce(async () => state.rows.map((r) => ({ ...r })));
    expect(await expireDuePreviews(NOW)).toBe(1);
    expect(state.rows[0]!.status).toBe('EXPIRED');
    expect(createEvent.mock.calls[0]![0].data).toMatchObject({ action: 'EXPIRED', fromStatus: 'READY', toStatus: 'EXPIRED' });
    expect(suppress).toHaveBeenCalledWith('req_1', db);
  });

  it('leaves a preview alone if it was converted since the read', async () => {
    const row = ready({ expiresAt: daysAgo(1) });
    state.rows = [row];
    db.previewRequest.findMany.mockImplementationOnce(async () => {
      const snapshot = { ...row };
      row.status = 'CONVERTED';
      return [snapshot];
    });
    expect(await expireDuePreviews(NOW)).toBe(0);
    expect(row.status).toBe('CONVERTED');
  });
});

describe('purgeExpiredPreviewData', () => {
  function expired(overrides: Partial<Row> = {}): Row {
    return ready({
      status: 'EXPIRED',
      expiresAt: daysAgo(91),
      draftShopId: 'shop_draft',
      anonymisedAt: null,
      notes: 'call me',
      internalNotes: 'ops note',
      changesRequestedText: 'bigger logo',
      styleNotes: 'warm wood',
      aboutText: 'family shop',
      brandPrimaryColour: '#111111',
      instagramUrl: 'https://instagram.com/sharp',
      townCity: 'Leeds',
      barberCount: '2-3',
      ...overrides,
    });
  }

  it('asks only for non-converted, not-yet-anonymised requests past retention', async () => {
    await purgeExpiredPreviewData(NOW);
    const where = db.previewRequest.findMany.mock.calls[0]![0].where;
    expect(where.status.in).toEqual(['EXPIRED', 'DECLINED', 'REJECTED']);
    expect(where.anonymisedAt).toBeNull();
    expect(where.OR[0].expiresAt.lte).toEqual(daysAgo(90));
    expect(where.OR[1]).toEqual({ expiresAt: null, rejectedAt: { lte: daysAgo(90) } });
  });

  it('deletes the draft shop and personal data, keeping an anonymised record', async () => {
    state.rows = [expired()];
    expect(await purgeExpiredPreviewData(NOW)).toBe(1);
    expect(purgeShopData).toHaveBeenCalledWith(db, 'shop_draft');
    expect(deleteCheckouts).toHaveBeenCalledWith({ where: { shopId: 'shop_draft', status: 'PENDING' } });
    expect(deleteOutbox.mock.calls[0]![0].where.dedupeKey).toEqual({ startsWith: 'free-preview:', contains: 'req_1' });
    expect(deleteEvents).toHaveBeenCalledWith({ where: { previewRequestId: 'req_1' } });
    expect(db.previewHubMessage.updateMany).toHaveBeenCalledWith({
      where: { previewRequestId: 'req_1' },
      data: { body: '', authorEmail: null },
    });
    expect(db.previewHubMessage.deleteMany).toHaveBeenCalledWith({ where: { previewRequestId: 'req_1' } });
    expect(db.previewChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { previewRequestId: 'req_1' },
      data: { body: '', opsNote: null, attachmentId: null, anchor: expect.anything() },
    });
    expect(db.previewChangeRequest.deleteMany).toHaveBeenCalledWith({ where: { previewRequestId: 'req_1' } });
    expect(db.previewContentReview.updateMany).toHaveBeenCalled();
    expect(db.previewContentReview.deleteMany).toHaveBeenCalledWith({ where: { previewRequestId: 'req_1' } });

    const row = state.rows[0]!;
    expect(row).toMatchObject({
      status: 'EXPIRED',
      anonymisedAt: NOW,
      firstName: null,
      shopName: 'Deleted',
      townCity: 'Deleted',
      notes: null,
      internalNotes: null,
      changesRequestedText: null,
      styleNotes: null,
      aboutText: null,
      brandPrimaryColour: null,
      instagramUrl: null,
      draftShopId: null,
      publicToken: 'new-token',
      publicTokenHash: 'new-hash',
      detailsTokenHash: null,
      detailsTokenExpiresAt: null,
      barberCount: '2-3',
    });
    expect(row.email).toBe('deleted-req_1@anonymised.invalid');
    expect(JSON.stringify(row)).not.toContain('owner@example.com');
    expect(JSON.stringify(row)).not.toContain('Sharp Cuts');
  });

  it.each([
    ['an owner', { ownerUserId: 'user_1', shopPaidAt: null }, 0],
    ['a payment', { ownerUserId: null, shopPaidAt: NOW }, 0],
    ['a live subscription', { ownerUserId: null, shopPaidAt: null }, 1],
  ])('never touches a draft shop with %s', async (_label, shop, liveSubscriptions) => {
    state.rows = [expired()];
    state.shop = shop;
    state.liveSubscriptions = liveSubscriptions;
    expect(await purgeExpiredPreviewData(NOW)).toBe(0);
    expect(purgeShopData).not.toHaveBeenCalled();
    expect(state.rows[0]!.anonymisedAt).toBeNull();
    expect(state.rows[0]!.email).toBe('owner@example.com');
  });

  it('handles a rejected request with no draft shop', async () => {
    state.rows = [expired({ status: 'REJECTED', expiresAt: null, rejectedAt: daysAgo(91), draftShopId: null })];
    expect(await purgeExpiredPreviewData(NOW)).toBe(1);
    expect(purgeShopData).not.toHaveBeenCalled();
    expect(state.rows[0]!.anonymisedAt).toEqual(NOW);
  });

  it('carries on after one failure', async () => {
    state.rows = [expired(), expired({ id: 'req_2' })];
    purgeShopData.mockRejectedValueOnce(new Error('boom'));
    expect(await purgeExpiredPreviewData(NOW)).toBe(1);
    expect(state.rows[1]!.anonymisedAt).toEqual(NOW);
  });
});

describe('runFreePreviewLifecycle', () => {
  it('sends no follow-ups with the flag off, but expiry and retention still run', async () => {
    state.flag = false;
    state.rows = [ready({ expiresAt: daysAgo(1) })];
    const result = await runFreePreviewLifecycle(NOW);
    expect(result.expired).toBe(1);
    expect(result.followups).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
