import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureHubDraftShop = vi.fn();
const resolveHubContext = vi.fn();

vi.mock('@/lib/freePreview/ensureHubDraftShop', () => ({
  ensureHubDraftShop: (...args: unknown[]) => ensureHubDraftShop(...args),
}));
vi.mock('@/lib/freePreview/hubPage', () => ({
  resolveHubContext: (...args: unknown[]) => resolveHubContext(...args),
}));
vi.mock('./adminMode', () => ({
  ADMIN_PRIVATE_HEADERS: {},
  adminSessionShopFor: vi.fn(),
  resolveAdminPageMode: vi.fn(),
}));
vi.mock('./previewHubPage', () => ({
  preparePreviewHubPage: vi.fn(),
}));
vi.mock('./previewHubPaths', () => ({
  paidAdminRedirectForHubPath: vi.fn(),
}));

import { ensureHubModeDraftShop } from './previewHubAdminPage';
import type { AdminPageMode } from './adminMode';

const NOW = new Date('2026-11-01T18:00:00Z');

function hubMode(draftShopId: string | null, stage = 'review'): Extract<AdminPageMode, { kind: 'hub' }> {
  return {
    kind: 'hub',
    phase: 'preview',
    setCookie: null,
    ctx: {
      token: '',
      source: 'cookie',
      request: { id: 'req_1', draftShopId } as never,
      state: { kind: 'hub', stage } as never,
      isOperator: false,
      draft: null,
    },
  };
}

beforeEach(() => {
  ensureHubDraftShop.mockReset();
  resolveHubContext.mockReset();
});

describe('ensureHubModeDraftShop', () => {
  it('returns the mode unchanged when a draft shop is already linked', async () => {
    const mode = hubMode('shop_existing');
    expect(await ensureHubModeDraftShop(mode, NOW)).toBe(mode);
    expect(ensureHubDraftShop).not.toHaveBeenCalled();
  });

  it('creates the draft shop on first Team / Services / Products visit and reloads context', async function () {
    const reloaded = {
      token: '',
      source: 'cookie',
      request: { id: 'req_1', draftShopId: 'shop_new' },
      state: { kind: 'hub', stage: 'review' },
      isOperator: false,
      draft: { shop: { id: 'shop_new' } },
    };
    ensureHubDraftShop.mockResolvedValue({ ok: true, shopId: 'shop_new', created: true });
    resolveHubContext.mockResolvedValue(reloaded);

    const next = await ensureHubModeDraftShop(hubMode(null), NOW);

    expect(ensureHubDraftShop).toHaveBeenCalledWith('req_1');
    expect(resolveHubContext).toHaveBeenCalledWith(
      { previewRequestId: 'req_1' },
      { isOperator: false, now: NOW },
    );
    expect(next.ctx.request.draftShopId).toBe('shop_new');
  });

  it('does not create a shop after payment (launch / live)', async () => {
    expect((await ensureHubModeDraftShop(hubMode(null, 'launch'), NOW)).ctx.request.draftShopId).toBeNull();
    expect(ensureHubDraftShop).not.toHaveBeenCalled();
  });

  it('keeps the original mode when ensure fails', async () => {
    ensureHubDraftShop.mockResolvedValue({ ok: false, code: 'INVALID_TRANSITION', httpStatus: 409 });
    const mode = hubMode(null);
    expect(await ensureHubModeDraftShop(mode, NOW)).toBe(mode);
    expect(resolveHubContext).not.toHaveBeenCalled();
  });
});
