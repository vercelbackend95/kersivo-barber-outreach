import { beforeEach, describe, expect, it, vi } from 'vitest';

const deletePrivateOnboardingFile = vi.fn();

vi.mock('@/lib/storage/privateOnboardingBlob', () => ({
  deletePrivateOnboardingFile: (...args: unknown[]) => deletePrivateOnboardingFile(...args),
}));

import {
  deletePrivateBlobPathsBestEffort,
  listPrivateBlobPathsForShopPurge,
  purgeShopData,
} from './purgeShopData';

describe('purgeShopData outbox + private blob helpers', () => {
  const emailOutbound = { deleteMany: vi.fn() };
  const smsOutbound = { deleteMany: vi.fn() };
  const booking = { deleteMany: vi.fn() };
  const order = { deleteMany: vi.fn() };
  const shopSettings = { delete: vi.fn() };
  const legalAcceptance = { deleteMany: vi.fn() };
  const saasSubscription = { deleteMany: vi.fn() };

  beforeEach(() => {
    emailOutbound.deleteMany.mockReset();
    smsOutbound.deleteMany.mockReset();
    booking.deleteMany.mockReset();
    order.deleteMany.mockReset();
    shopSettings.delete.mockReset();
    legalAcceptance.deleteMany.mockReset();
    saasSubscription.deleteMany.mockReset();
    deletePrivateOnboardingFile.mockReset();
  });

  it('deletes EmailOutbound and SmsOutbound by shopId before bookings/orders/shop', async () => {
    const calls: string[] = [];
    emailOutbound.deleteMany.mockImplementation(async () => {
      calls.push('email');
    });
    smsOutbound.deleteMany.mockImplementation(async () => {
      calls.push('sms');
    });
    booking.deleteMany.mockImplementation(async () => {
      calls.push('booking');
    });
    order.deleteMany.mockImplementation(async () => {
      calls.push('order');
    });
    shopSettings.delete.mockImplementation(async () => {
      calls.push('shop');
    });

    const tx = {
      emailOutbound,
      smsOutbound,
      booking,
      order,
      shopSettings,
      legalAcceptance,
      saasSubscription,
    };

    await purgeShopData(tx as never, 'shop-1');

    expect(emailOutbound.deleteMany).toHaveBeenCalledWith({ where: { shopId: 'shop-1' } });
    expect(smsOutbound.deleteMany).toHaveBeenCalledWith({ where: { shopId: 'shop-1' } });
    expect(calls).toEqual(['email', 'sms', 'booking', 'order', 'shop']);
    expect(legalAcceptance.deleteMany).not.toHaveBeenCalled();
    expect(saasSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('lists onboarding storage paths and private note pathnames only', async () => {
    const db = {
      clientOnboardingAsset: {
        findMany: vi.fn().mockResolvedValue([
          { storagePath: 'client-onboarding/shop-1/brand_logo/a.png' },
        ]),
      },
      clientNoteImage: {
        findMany: vi.fn().mockResolvedValue([
          { url: 'client-notes/shop-1/client-1/note-0.webp' },
          { url: 'https://public.blob.vercel-storage.com/legacy.webp' },
          { url: 'data:image/webp;base64,abc' },
          { url: '/images/demo.webp' },
        ]),
      },
    };

    const paths = await listPrivateBlobPathsForShopPurge('shop-1', db as never);
    expect(paths).toEqual([
      'client-onboarding/shop-1/brand_logo/a.png',
      'client-notes/shop-1/client-1/note-0.webp',
    ]);
  });

  it('best-effort deletes private blobs and logs failures without throwing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    deletePrivateOnboardingFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('blob gone'));

    await expect(
      deletePrivateBlobPathsBestEffort([
        'client-onboarding/shop-1/a.png',
        'client-notes/shop-1/n.webp',
      ]),
    ).resolves.toBeUndefined();

    expect(deletePrivateOnboardingFile).toHaveBeenCalledTimes(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
