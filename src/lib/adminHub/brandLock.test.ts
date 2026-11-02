import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { HUB_BRAND_LOCKED } from '@/lib/freePreview/hubCopy';

type ColourRow = {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  brandBackgroundTone: string | null;
  brandColoursSource: string | null;
  brandPaletteExtracted: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt: Date | null;
};

const SENT_AT = new Date('2026-11-02T12:00:00.000Z');
const NOW = new Date('2026-11-02T13:00:00.000Z');

const state: {
  row: ColourRow | null;
  events: unknown[];
  logo: { id: string; storagePath: string; originalFileName: string; contentType: string } | null;
} = {
  row: null,
  events: [],
  logo: null,
};

const tx = {
  $queryRaw: vi.fn(async () => undefined),
  previewRequest: {
    findUnique: vi.fn(async () => state.row),
    findUniqueOrThrow: vi.fn(async () => {
      if (!state.row) throw new Error('not found');
      return state.row;
    }),
    updateMany: vi.fn(async (args: { where: { brandColoursSentAt: Date | null }; data: Record<string, unknown> }) => {
      if (!state.row) return { count: 0 };
      if (args.where.brandColoursSentAt === null && state.row.brandColoursSentAt !== null) {
        return { count: 0 };
      }
      Object.assign(state.row, args.data);
      return { count: 1 };
    }),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => {
      if (!state.row) throw new Error('not found');
      Object.assign(state.row, args.data);
      const created = (args.data.events as { create?: unknown } | undefined)?.create;
      if (created) state.events.push(created);
      return state.row;
    }),
  },
  previewRequestEvent: {
    create: vi.fn(async (args: { data: unknown }) => {
      state.events.push(args.data);
      return { id: `evt_${state.events.length}` };
    }),
  },
  previewHubAsset: {
    findFirst: vi.fn(async () => state.logo),
  },
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    previewRequest: {
      findUnique: (...args: unknown[]) => tx.previewRequest.findUnique(...(args as [])),
    },
  },
}));

import {
  BrandLockedError,
  assertBrandUnlocked,
  brandLockState,
  unlockBrandColours,
} from './brandLock';
import { saveBrandColours } from './brandColours';

function unlockedRow(): ColourRow {
  return {
    brandPrimaryColour: '#1F6F6B',
    brandSecondaryColour: '#C9A24A',
    brandBackgroundTone: 'DARK',
    brandColoursSource: 'LOGO',
    brandPaletteExtracted: [{ hex: '#1F6F6B', share: 0.4 }],
    brandColoursSentAt: null,
  };
}

beforeEach(() => {
  state.row = unlockedRow();
  state.events = [];
  state.logo = {
    id: 'logo_1',
    storagePath: 'hub/req_1/logo.png',
    originalFileName: 'mark.png',
    contentType: 'image/png',
  };
  tx.$queryRaw.mockClear();
  tx.previewRequest.findUnique.mockClear();
  tx.previewRequest.findUniqueOrThrow.mockClear();
  tx.previewRequest.updateMany.mockClear();
  tx.previewRequest.update.mockClear();
  tx.previewRequestEvent.create.mockClear();
  tx.previewHubAsset.findFirst.mockClear();
});

describe('brandLockState', () => {
  it('exposes submittedAt and locked from brandColoursSentAt', () => {
    expect(brandLockState(null)).toEqual({ locked: false, submittedAt: null });
    expect(brandLockState(SENT_AT)).toEqual({ locked: true, submittedAt: SENT_AT.toISOString() });
  });
});

describe('saveBrandColours lock', () => {
  it('submits once, stores a snapshot and writes BRAND_COLOURS_SENT', async () => {
    const saved = await saveBrandColours({
      requestId: 'req_1',
      patch: { send: true, brandColoursSource: 'LOGO' },
      submittedByUserId: 'user_1',
      now: NOW,
    });
    expect(saved.brandLocked).toBe(true);
    expect(saved.brandColoursSentAt).toBe(NOW.toISOString());
    expect(tx.previewRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req_1', brandColoursSentAt: null },
      }),
    );
    const submitData = tx.previewRequest.updateMany.mock.calls[0]![0].data as {
      brandSubmittedSnapshot: Record<string, unknown>;
    };
    expect(submitData.brandSubmittedSnapshot).toMatchObject({
      logoAssetId: 'logo_1',
      logoStoragePath: 'hub/req_1/logo.png',
      brandPrimaryColour: '#1F6F6B',
      submittedByUserId: 'user_1',
    });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      action: PREVIEW_REQUEST_ACTIONS.BRAND_COLOURS_SENT,
      previewRequestId: 'req_1',
    });
  });

  it('returns 409-shaped BrandLockedError on a second submit and does not write another event', async () => {
    await saveBrandColours({ requestId: 'req_1', patch: { send: true }, now: SENT_AT });
    expect(state.events).toHaveLength(1);
    await expect(saveBrandColours({ requestId: 'req_1', patch: { send: true }, now: NOW })).rejects.toMatchObject({
      code: 'BRAND_LOCKED',
      submittedAt: SENT_AT.toISOString(),
      message: HUB_BRAND_LOCKED,
    });
    expect(state.events).toHaveLength(1);
    expect(tx.previewRequestEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.previewRequest.updateMany).toHaveBeenCalledTimes(1);
  });

  it('blocks colour changes after submit', async () => {
    await saveBrandColours({ requestId: 'req_1', patch: { send: true }, now: SENT_AT });
    await expect(
      saveBrandColours({ requestId: 'req_1', patch: { brandPrimaryColour: '#111111' } }),
    ).rejects.toBeInstanceOf(BrandLockedError);
    expect(state.row?.brandPrimaryColour).toBe('#1F6F6B');
  });

  it('re-enables colour changes after unlock', async () => {
    await saveBrandColours({ requestId: 'req_1', patch: { send: true }, now: SENT_AT });
    const unlocked = await unlockBrandColours({
      requestId: 'req_1',
      actorEmail: 'ops@kersivo.co.uk',
      now: NOW,
    });
    expect(unlocked).toEqual({ ok: true, wasLocked: true, submittedAt: SENT_AT.toISOString() });
    expect(state.row?.brandColoursSentAt).toBeNull();
    expect(state.events[1]).toMatchObject({
      action: PREVIEW_REQUEST_ACTIONS.BRAND_UNLOCKED,
      actorEmail: 'ops@kersivo.co.uk',
    });

    const saved = await saveBrandColours({
      requestId: 'req_1',
      patch: { brandPrimaryColour: '#141414' },
    });
    expect(saved.brandPrimaryColour).toBe('#141414');
    expect(saved.brandLocked).toBe(false);
  });
});

describe('assertBrandUnlocked', () => {
  it('throws BRAND_LOCKED when brandColoursSentAt is set', async () => {
    state.row = { ...unlockedRow(), brandColoursSentAt: SENT_AT };
    await expect(assertBrandUnlocked('req_1')).rejects.toMatchObject({
      code: 'BRAND_LOCKED',
      submittedAt: SENT_AT.toISOString(),
    });
  });

  it('allows changes when unlocked', async () => {
    await expect(assertBrandUnlocked('req_1')).resolves.toBeUndefined();
  });
});

describe('unlockBrandColours', () => {
  it('keeps the snapshot and records who unlocked', async () => {
    state.row = { ...unlockedRow(), brandColoursSentAt: SENT_AT };
    const result = await unlockBrandColours({
      requestId: 'req_1',
      actorEmail: 'ops@kersivo.co.uk',
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(state.events[0]).toMatchObject({
      action: 'BRAND_UNLOCKED',
      actorEmail: 'ops@kersivo.co.uk',
      meta: expect.objectContaining({ previouslySubmittedAt: SENT_AT.toISOString() }),
    });
  });

  it('returns NOT_FOUND when the preview request is missing', async () => {
    state.row = null;
    expect(await unlockBrandColours({ requestId: 'missing', actorEmail: 'ops@kersivo.co.uk' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
  });
});

describe('preview brand lock migration', () => {
  it('adds snapshot columns and backfills from brandColoursSentAt', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20261102120000_preview_brand_lock/migration.sql'),
      'utf8',
    );
    expect(sql).toContain('ADD COLUMN "brandSubmittedByUserId" TEXT');
    expect(sql).toContain('ADD COLUMN "brandSubmittedSnapshot" JSONB');
    expect(sql).toContain('WHERE pr2."brandColoursSentAt" IS NOT NULL');
    expect(sql).toContain('kind = \'LOGO\'');
  });
});
