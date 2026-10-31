import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  status: string;
  draftShopId: string | null;
  shopName: string;
  townCity: string;
  email: string;
  firstName: string | null;
  publicToken: string;
  draftShop: { sitePreviewUrl: string | null } | null;
};

const state: { request: Row | null; flag: boolean } = { request: null, flag: true };
const update = vi.fn();
const createEvent = vi.fn(async () => ({ id: 'evt_1' }));
const enqueueEmail = vi.fn(async (..._args: unknown[]) => ({ id: 'outbox_1' }));
const tryDeliverOutboxEmail = vi.fn();
const applySitePreview = vi.fn();
const plainFindUnique = vi.fn();
const plainCreateEvent = vi.fn();

const tx = {
  $queryRaw: vi.fn(),
  previewRequest: { findUnique: vi.fn(async () => state.request), update: (...a: unknown[]) => update(...a) },
  previewRequestEvent: { create: () => createEvent(), findFirst: vi.fn(async () => null) },
  previewChangeRequest: { findMany: vi.fn(async () => []) },
  shopSettings: { findUnique: vi.fn() },
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    previewRequest: { findUnique: (...a: unknown[]) => plainFindUnique(...a) },
    previewRequestEvent: { create: (...a: unknown[]) => plainCreateEvent(...a) },
  },
}));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
  tryDeliverOutboxEmail: (...a: unknown[]) => tryDeliverOutboxEmail(...a),
}));
vi.mock('@/lib/preview/shopPreviewSession', () => ({ createDraftShop: vi.fn() }));
vi.mock('@/lib/setup/sitePreview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/setup/sitePreview')>()),
  applySitePreview: (...a: unknown[]) => applySitePreview(...a),
}));
vi.mock('@/lib/setup/siteUrl', () => ({ getPublicSiteUrl: () => 'https://kersivo.co.uk' }));
vi.mock('./config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config')>()),
  isFreePreviewFlowEnabled: () => state.flag,
}));

import { executePreviewRequestOpsAction, previewRequestOpsActionSchema } from './opsActions';

const NOW = new Date('2026-11-01T10:00:00Z');
const TOKEN = 'A'.repeat(43);

function run(action: unknown) {
  return executePreviewRequestOpsAction({
    id: 'req_1',
    action: previewRequestOpsActionSchema.parse(action),
    actorEmail: 'ops@kersivo.co.uk',
    now: NOW,
  });
}

function sentEmail() {
  return enqueueEmail.mock.calls[0]![1] as Record<string, string>;
}

describe('mark_ready_and_send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.flag = true;
    state.request = {
      id: 'req_1',
      status: 'IN_PROGRESS',
      draftShopId: 'shop_draft',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
      email: 'sam@example.com',
      firstName: 'Sam',
      publicToken: TOKEN,
      draftShop: { sitePreviewUrl: 'https://sharp-cuts-preview.vercel.app' },
    };
  });

  it('sets ready + 30-day expiry and sends E3 with the real preview URL and expiry date', async () => {
    const result = await run({ action: 'mark_ready_and_send' });
    expect(result).toEqual({ ok: true, status: 'READY', draftShopId: 'shop_draft', emailSent: 'E3' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { status: 'READY', previewReadyAt: NOW, expiresAt: new Date('2026-12-01T10:00:00Z') },
    });
    const email = sentEmail();
    expect(email.purpose).toBe('FREE_PREVIEW_READY');
    expect(email.to).toBe('sam@example.com');
    expect(email.subject).toBe('Your website preview for Sharp Cuts is ready');
    expect(email.html).toContain(`https://kersivo.co.uk/preview/${TOKEN}`);
    expect(email.html).toContain('Your preview link works until 1 December 2026.');
    expect(email.dedupeKey).toBe('free-preview:ready:req_1:evt_1');
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('outbox_1');
  });

  it('sends E4 instead when the owner had requested changes', async () => {
    state.request!.status = 'CHANGES_REQUESTED';
    const result = await run({ action: 'mark_ready_and_send' });
    expect(result).toMatchObject({ ok: true, status: 'READY', emailSent: 'E4' });
    const email = sentEmail();
    expect(email.purpose).toBe('FREE_PREVIEW_UPDATED');
    expect(email.subject).toBe("We've updated your Sharp Cuts preview");
    expect(email.html).toContain(`https://kersivo.co.uk/preview/${TOKEN}`);
    expect(email.html).toContain('Your link works until 1 December 2026.');
  });

  it('refuses without a website preview, a draft shop, the flag, or from READY/final statuses', async () => {
    state.request!.draftShop = { sitePreviewUrl: null };
    expect(await run({ action: 'mark_ready_and_send' })).toMatchObject({ ok: false, code: 'SITE_PREVIEW_MISSING' });
    state.request!.draftShopId = null;
    expect(await run({ action: 'mark_ready_and_send' })).toMatchObject({ ok: false, code: 'NO_DRAFT_SHOP' });
    state.request!.draftShopId = 'shop_draft';
    state.request!.status = 'CONVERTED';
    expect(await run({ action: 'mark_ready_and_send' })).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
    state.request!.status = 'READY';
    expect(await run({ action: 'mark_ready_and_send' })).toMatchObject({ ok: false, code: 'INVALID_TRANSITION' });
    state.request!.status = 'IN_PROGRESS';
    state.flag = false;
    expect(await run({ action: 'mark_ready_and_send' })).toMatchObject({ ok: false, code: 'PREVIEW_FLOW_DISABLED' });
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('set_site_preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plainFindUnique.mockResolvedValue({ id: 'req_1', status: 'IN_PROGRESS', draftShopId: 'shop_draft' });
    applySitePreview.mockResolvedValue({ ok: true, action: 'ready' });
  });

  it('points the draft shop at the website preview through the shared site-preview logic', async () => {
    const result = await run({
      action: 'set_site_preview',
      previewUrl: 'https://sharp-cuts.vercel.app/',
      siteVersion: 'v1',
    });
    expect(result).toEqual({ ok: true, status: 'IN_PROGRESS', draftShopId: 'shop_draft' });
    expect(applySitePreview).toHaveBeenCalledWith({
      shopId: 'shop_draft',
      previewUrl: 'https://sharp-cuts.vercel.app',
      siteVersion: 'v1',
      email: 'ops@kersivo.co.uk',
    });
  });

  it('rejects non-https URLs and requests without a draft shop', async () => {
    expect(
      await run({ action: 'set_site_preview', previewUrl: 'http://x.example', siteVersion: 'v1' }),
    ).toMatchObject({ ok: false, code: 'INVALID_PREVIEW_URL' });
    plainFindUnique.mockResolvedValue({ id: 'req_1', status: 'IN_PROGRESS', draftShopId: null });
    expect(
      await run({ action: 'set_site_preview', previewUrl: 'https://x.example', siteVersion: 'v1' }),
    ).toMatchObject({ ok: false, code: 'NO_DRAFT_SHOP' });
    expect(applySitePreview).not.toHaveBeenCalled();
  });
});
