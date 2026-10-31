import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
const eventCreate = vi.fn();
const enqueueEmail = vi.fn();
const tryDeliverOutboxEmail = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    previewRequest: { findUnique: (...args: unknown[]) => findUnique(...args) },
    $transaction: (run: (tx: unknown) => unknown) =>
      run({ previewRequest: { update }, previewRequestEvent: { create: eventCreate } }),
  },
}));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
  tryDeliverOutboxEmail: (...args: unknown[]) => tryDeliverOutboxEmail(...args),
}));

import { hashPreviewToken } from '@/lib/preview/shopPreviewSession';
import { savePreviewRequestDetails } from './savePreviewRequestDetails';

const NOW = new Date('2026-10-31T12:00:00Z');
const TOKEN = 'a'.repeat(43);
const row = {
  id: 'req_1',
  email: 'sam@example.com',
  shopName: 'Sharp & Co',
  townCity: 'Leeds',
  detailsTokenExpiresAt: new Date('2026-11-01T11:59:59Z'),
  marketingOptInAt: null as Date | null,
};

describe('savePreviewRequestDetails', () => {
  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue(row);
    update.mockReset().mockResolvedValue({});
    eventCreate.mockReset().mockResolvedValue({ id: 'evt_1' });
    enqueueEmail.mockReset().mockImplementation((_tx, email: { dedupeKey: string }) => ({ id: email.dedupeKey }));
    tryDeliverOutboxEmail.mockReset().mockResolvedValue(undefined);
  });

  it('looks the request up by the token hash, never the raw token', async () => {
    await savePreviewRequestDetails({ token: TOKEN, barberCount: '1' }, NOW);
    expect(findUnique.mock.calls[0]?.[0].where).toEqual({ detailsTokenHash: hashPreviewToken(TOKEN) });
  });

  it('rejects an unknown token', async () => {
    findUnique.mockResolvedValue(null);
    expect(await savePreviewRequestDetails({ token: TOKEN, barberCount: '1' }, NOW)).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['exactly at expiry', new Date(NOW)],
    ['past expiry', new Date('2026-10-30T12:00:00Z')],
    ['with no expiry stored', null],
  ])('rejects a token %s', async (_name, detailsTokenExpiresAt) => {
    findUnique.mockResolvedValue({ ...row, detailsTokenExpiresAt });
    expect(await savePreviewRequestDetails({ token: TOKEN, barberCount: '1' }, NOW)).toEqual({
      ok: false,
      code: 'EXPIRED',
      httpStatus: 410,
    });
    expect(update).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('updates only what was answered, logs field names only and emails ops once', async () => {
    const result = await savePreviewRequestDetails(
      { token: TOKEN, currentBookingSystem: 'booksy', notes: 'Use the <red> logo', marketingOptIn: true },
      NOW,
    );
    expect(result).toEqual({ ok: true, updated: true });
    expect(update.mock.calls[0]?.[0]).toEqual({
      where: { id: 'req_1' },
      data: { currentBookingSystem: 'booksy', notes: 'Use the <red> logo', marketingOptInAt: NOW },
    });
    expect(eventCreate.mock.calls[0]?.[0].data).toEqual({
      previewRequestId: 'req_1',
      action: 'DETAILS_UPDATED',
      meta: { fields: ['currentBookingSystem', 'notes', 'marketingOptInAt'] },
    });
    const email = enqueueEmail.mock.calls[0]?.[1] as { subject: string; html: string; dedupeKey: string; replyTo: string };
    expect(email.subject).toBe('Preview details added: Sharp & Co, Leeds');
    expect(email.replyTo).toBe('sam@example.com');
    expect(email.dedupeKey).toBe('free-preview:details:req_1:evt_1');
    expect(email.html).toContain('Use the &lt;red&gt; logo');
    expect(email.html).toContain('Booksy');
    expect(email.html).not.toContain('Barbers');
    expect(tryDeliverOutboxEmail).toHaveBeenCalledTimes(1);
  });

  it('keeps the original opt-in date and withdraws on an explicit false', async () => {
    const earlier = new Date('2026-10-31T11:00:00Z');
    findUnique.mockResolvedValue({ ...row, marketingOptInAt: earlier });
    expect(await savePreviewRequestDetails({ token: TOKEN, marketingOptIn: true }, NOW)).toEqual({
      ok: true,
      updated: false,
    });
    await savePreviewRequestDetails({ token: TOKEN, marketingOptIn: false }, NOW);
    expect(update.mock.calls[0]?.[0].data).toEqual({ marketingOptInAt: null });
  });

  it('does nothing and sends nothing when there are no answers', async () => {
    expect(await savePreviewRequestDetails({ token: TOKEN }, NOW)).toEqual({ ok: true, updated: false });
    expect(update).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
