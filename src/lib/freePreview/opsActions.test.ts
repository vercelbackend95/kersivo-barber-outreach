import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; status: string; draftShopId: string | null; shopName: string; townCity: string };

const state: { request: Row | null; shop: Record<string, unknown> | null } = { request: null, shop: null };
const update = vi.fn();
const createDraftShop = vi.fn();

const tx = {
  $queryRaw: vi.fn(),
  previewRequest: {
    findUnique: vi.fn(async () => state.request),
    update: (...args: unknown[]) => update(...args),
  },
  shopSettings: { findUnique: vi.fn(async () => state.shop) },
};

vi.mock('@/lib/db/client', () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}));
vi.mock('@/lib/preview/shopPreviewSession', () => ({
  createDraftShop: (...args: unknown[]) => createDraftShop(...args),
}));

import { executePreviewRequestOpsAction, previewRequestOpsActionSchema } from './opsActions';

function run(action: unknown) {
  return executePreviewRequestOpsAction({
    id: 'req_1',
    action: previewRequestOpsActionSchema.parse(action),
    actorEmail: 'ops@kersivo.co.uk',
  });
}

describe('executePreviewRequestOpsAction', () => {
  beforeEach(() => {
    state.request = { id: 'req_1', status: 'REQUESTED', draftShopId: null, shopName: 'Sharp Cuts', townCity: 'Leeds' };
    state.shop = null;
    update.mockReset();
    createDraftShop.mockReset().mockResolvedValue({ id: 'shop_new' });
  });

  it('returns NOT_FOUND for an unknown request', async () => {
    state.request = null;
    expect(await run({ action: 'reject' })).toEqual({ ok: false, code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('moves REQUESTED to IN_PROGRESS and records the event', async () => {
    const result = await run({ action: 'set_status', status: 'IN_PROGRESS' });
    expect(result).toEqual({ ok: true, status: 'IN_PROGRESS', draftShopId: null });
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: 'IN_PROGRESS',
        events: { create: { fromStatus: 'REQUESTED', toStatus: 'IN_PROGRESS', actorEmail: 'ops@kersivo.co.uk' } },
      },
    });
  });

  it('refuses manual status changes once the preview is ready', async () => {
    state.request!.status = 'READY';
    expect(await run({ action: 'set_status', status: 'IN_PROGRESS' })).toMatchObject({
      ok: false,
      code: 'INVALID_TRANSITION',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects without email and refuses to reject a converted request', async () => {
    const result = await run({ action: 'reject' });
    expect(result).toMatchObject({ ok: true, status: 'REJECTED' });
    expect(update.mock.calls[0]?.[0]).toMatchObject({ data: { status: 'REJECTED' } });

    update.mockReset();
    state.request!.status = 'CONVERTED';
    expect(await run({ action: 'reject' })).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a draft shop named after the request, once', async () => {
    const result = await run({ action: 'create_draft_shop' });
    expect(result).toEqual({ ok: true, status: 'REQUESTED', draftShopId: 'shop_new' });
    expect(createDraftShop).toHaveBeenCalledWith({ name: 'Sharp Cuts', townCity: 'Leeds' }, tx);

    state.request!.draftShopId = 'shop_new';
    expect(await run({ action: 'create_draft_shop' })).toMatchObject({ ok: false, code: 'DRAFT_SHOP_ALREADY_LINKED' });
  });

  it('links only an existing, ownerless, unlinked shop', async () => {
    expect(await run({ action: 'link_draft_shop', shopId: 'shop_x' })).toMatchObject({ code: 'SHOP_NOT_FOUND' });

    state.shop = { id: 'shop_x', ownerUserId: 'user_1', previewRequest: null };
    expect(await run({ action: 'link_draft_shop', shopId: 'shop_x' })).toMatchObject({ code: 'SHOP_HAS_OWNER' });

    state.shop = { id: 'shop_x', ownerUserId: null, previewRequest: { id: 'req_2' } };
    expect(await run({ action: 'link_draft_shop', shopId: 'shop_x' })).toMatchObject({ code: 'SHOP_LINKED_ELSEWHERE' });

    state.shop = { id: 'shop_x', ownerUserId: null, previewRequest: null };
    expect(await run({ action: 'link_draft_shop', shopId: 'shop_x' })).toEqual({
      ok: true,
      status: 'REQUESTED',
      draftShopId: 'shop_x',
    });
  });

  it('rejects statuses ops cannot set by hand', () => {
    expect(previewRequestOpsActionSchema.safeParse({ action: 'set_status', status: 'CONVERTED' }).success).toBe(false);
  });
});
