import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePreviewRequestByToken = vi.fn();
const enqueueEmail = vi.fn(async (..._a: unknown[]) => ({ id: 'outbox_9' }));
const tryDeliverOutboxEmail = vi.fn();
const state: { row: Record<string, unknown> | null } = { row: null };

const tx = {
  $queryRaw: vi.fn(),
  previewRequest: { findUnique: vi.fn(async () => state.row), update: vi.fn() },
  previewRequestEvent: { create: vi.fn(async () => ({ id: 'evt_7' })) },
};

vi.mock('./previewAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./previewAccess')>()),
  resolvePreviewRequestByToken: (...a: unknown[]) => resolvePreviewRequestByToken(...a),
}));
vi.mock('@/lib/db/client', () => ({ prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
  tryDeliverOutboxEmail: (...a: unknown[]) => tryDeliverOutboxEmail(...a),
}));
vi.mock('@/lib/setup/siteUrl', () => ({ getPublicSiteUrl: () => 'https://kersivo.co.uk' }));

import { previewChangesSchema, requestPreviewChanges } from './requestChanges';

const NOW = new Date('2026-11-03T08:00:00Z');

describe('requestPreviewChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePreviewRequestByToken.mockResolvedValue({ id: 'req_1' });
    state.row = {
      id: 'req_1',
      status: 'READY',
      expiresAt: new Date('2026-11-30T00:00:00Z'),
      draftShopId: 'shop_draft',
      email: 'sam@example.com',
      shopName: 'Sharp Cuts',
      townCity: 'Leeds',
    };
  });

  it('sets changes_requested and emails PREVIEW_NOTIFY_EMAIL', async () => {
    expect(await requestPreviewChanges({ token: 'x', changes: 'Darker header, please.', now: NOW })).toEqual({ ok: true });
    expect(tx.previewRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { status: 'CHANGES_REQUESTED', changesRequestedText: 'Darker header, please.', changesRequestedAt: NOW },
    });
    const email = enqueueEmail.mock.calls[0]![1] as Record<string, string>;
    expect(email.purpose).toBe('FREE_PREVIEW_CHANGES_REQUESTED_INTERNAL');
    expect(email.to).toBe('hello@kersivo.co.uk');
    expect(email.replyTo).toBe('sam@example.com');
    expect(email.html).toContain('Darker header, please.');
    expect(tryDeliverOutboxEmail).toHaveBeenCalledWith('outbox_9');
  });

  it('escapes the owner text in the internal email', async () => {
    await requestPreviewChanges({ token: 'x', changes: '<script>alert(1)</script>', now: NOW });
    const email = enqueueEmail.mock.calls[0]![1] as Record<string, string>;
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('refuses unknown tokens and expired or unsent previews', async () => {
    resolvePreviewRequestByToken.mockResolvedValueOnce(null);
    expect(await requestPreviewChanges({ token: 'x', changes: 'a', now: NOW })).toMatchObject({ code: 'NOT_FOUND' });
    state.row = { ...state.row!, expiresAt: new Date('2026-11-01T00:00:00Z') };
    expect(await requestPreviewChanges({ token: 'x', changes: 'a', now: NOW })).toMatchObject({ code: 'NOT_AVAILABLE' });
    state.row = { ...state.row!, expiresAt: null, status: 'IN_PROGRESS' };
    expect(await requestPreviewChanges({ token: 'x', changes: 'a', now: NOW })).toMatchObject({ code: 'NOT_AVAILABLE' });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('limits the text to 2,000 characters', () => {
    expect(previewChangesSchema.safeParse({ changes: 'x'.repeat(2000) }).success).toBe(true);
    expect(previewChangesSchema.safeParse({ changes: 'x'.repeat(2001) }).success).toBe(false);
    expect(previewChangesSchema.safeParse({ changes: '   ' }).success).toBe(false);
  });
});
