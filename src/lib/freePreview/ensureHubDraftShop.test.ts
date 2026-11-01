import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  status: string;
  draftShopId: string | null;
  shopName: string;
  townCity: string;
  anonymisedAt: Date | null;
};

const state: { request: Row | null } = { request: null };
const update = vi.fn();
const createDraftShop = vi.fn();
let lockQueue = Promise.resolve();

const tx = {
  $queryRaw: vi.fn(async () => undefined),
  previewRequest: {
    findUnique: vi.fn(async () => state.request),
    update: (...args: unknown[]) => update(...args),
  },
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => {
      const run = lockQueue.then(() => fn(tx));
      lockQueue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  },
}));

vi.mock('@/lib/preview/shopPreviewSession', () => ({
  createDraftShop: (...args: unknown[]) => createDraftShop(...args),
}));

import { ensureHubDraftShop, HUB_DRAFT_SHOP_ACTOR } from './ensureHubDraftShop';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';

describe('ensureHubDraftShop', () => {
  beforeEach(() => {
    lockQueue = Promise.resolve();
    state.request = {
      id: 'req_1',
      status: 'REQUESTED',
      draftShopId: null,
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      anonymisedAt: null,
    };
    update.mockReset().mockImplementation(async (args: { data: { draftShopId: string } }) => {
      state.request!.draftShopId = args.data.draftShopId;
    });
    createDraftShop.mockReset().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { id: 'shop_new' };
    });
  });

  it('creates a paused draft shop once and records DRAFT_SHOP_CREATED as owner:hub', async () => {
    const result = await ensureHubDraftShop('req_1');
    expect(result).toEqual({ ok: true, shopId: 'shop_new', created: true });
    expect(createDraftShop).toHaveBeenCalledWith({ name: 'Sharp Cuts', townCity: 'Leeds' }, tx);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      data: {
        draftShopId: 'shop_new',
        events: {
          create: {
            action: PREVIEW_REQUEST_ACTIONS.DRAFT_SHOP_CREATED,
            actorEmail: HUB_DRAFT_SHOP_ACTOR,
            meta: { shopId: 'shop_new', source: 'hub' },
          },
        },
      },
    });
  });

  it('is idempotent for two parallel calls', async () => {
    const [first, second] = await Promise.all([ensureHubDraftShop('req_1'), ensureHubDraftShop('req_1')]);
    expect(first).toEqual({ ok: true, shopId: 'shop_new', created: true });
    expect(second).toEqual({ ok: true, shopId: 'shop_new', created: false });
    expect(createDraftShop).toHaveBeenCalledTimes(1);
  });

  it('returns the existing shop without creating another', async () => {
    state.request!.draftShopId = 'shop_existing';
    expect(await ensureHubDraftShop('req_1')).toEqual({
      ok: true,
      shopId: 'shop_existing',
      created: false,
    });
    expect(createDraftShop).not.toHaveBeenCalled();
  });

  it('refuses final, expired and anonymised requests', async () => {
    state.request!.status = 'CONVERTED';
    expect(await ensureHubDraftShop('req_1')).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });

    state.request!.status = 'REQUESTED';
    state.request!.anonymisedAt = new Date();
    expect(await ensureHubDraftShop('req_1')).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });

    state.request = null;
    expect(await ensureHubDraftShop('req_1')).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });
});
