import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma, tx, writes } = vi.hoisted(() => {
  const writes: string[] = [];
  const review = {
    id: 'rev_1',
    previewRequestId: 'req_1',
    section: 'SERVICES' as const,
    state: 'CORRECTIONS_SENT' as const,
    proposal: {
      baseline: JSON.stringify([{ id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 }]),
      services: [{ clientId: 'svc_1', id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2200 }],
    },
  };
  const tx = {
    previewContentReview: {
      findFirst: vi.fn(async () => ({ ...review })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        writes.push('review');
        return { ...review, createdAt: new Date('2026-10-31T12:00:00Z'), appliedAt: new Date('2026-10-31T12:00:00Z'), ...data };
      }),
    },
    previewRequestEvent: {
      create: vi.fn(async () => {
        writes.push('event');
        return {};
      }),
    },
    service: {
      findMany: vi.fn(async () => [{ id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 }]),
      update: vi.fn(async () => {
        writes.push('service');
        return {};
      }),
      create: vi.fn(),
    },
    barber: { findMany: vi.fn(async () => []) },
    shopOpeningHours: { findMany: vi.fn(async () => []) },
    previewHubAsset: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
    barberService: { createMany: vi.fn() },
  };
  const prisma = {
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
      const snapshot = [...writes];
      try {
        return await fn(tx);
      } catch (error) {
        writes.length = 0;
        writes.push(...snapshot);
        writes.length = 0;
        throw error;
      }
    },
  };
  return { prisma, tx, writes, review };
});

vi.mock('@/lib/db/client', () => ({ prisma }));

import { applyHubContentReview, hubApplyTestHooks, servicesFingerprint } from './hubReviews';

describe('applyHubContentReview transaction', () => {
  beforeEach(() => {
    writes.length = 0;
    hubApplyTestHooks.throwAfterSectionWrite = '';
    tx.previewContentReview.findFirst.mockResolvedValue({
      id: 'rev_1',
      previewRequestId: 'req_1',
      section: 'SERVICES',
      state: 'CORRECTIONS_SENT',
      proposal: {
        baseline: servicesFingerprint([{ id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 }]),
        services: [{ clientId: 'svc_1', id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2200 }],
      },
    });
    tx.service.findMany.mockResolvedValue([
      { id: 'svc_1', name: 'Skin fade', durationMinutes: 45, pricePence: 2500 },
    ]);
    tx.previewContentReview.update.mockClear();
    tx.previewRequestEvent.create.mockClear();
    tx.service.update.mockClear();
  });

  it('writes section data, APPLIED state and the event in one transaction', async () => {
    const result = await applyHubContentReview({
      previewRequestId: 'req_1',
      reviewId: 'rev_1',
      shopId: 'shop_1',
      actorEmail: 'ops@kersivo.co.uk',
    });
    expect(result.ok).toBe(true);
    expect(writes).toEqual(['service', 'review', 'event']);
  });

  it('persists nothing when a write throws mid-apply', async () => {
    hubApplyTestHooks.throwAfterSectionWrite = 'mid-apply boom';
    await expect(
      applyHubContentReview({
        previewRequestId: 'req_1',
        reviewId: 'rev_1',
        shopId: 'shop_1',
        actorEmail: 'ops@kersivo.co.uk',
      }),
    ).rejects.toThrow('mid-apply boom');
    expect(writes).toEqual([]);
    expect(tx.previewContentReview.update).not.toHaveBeenCalled();
    expect(tx.previewRequestEvent.create).not.toHaveBeenCalled();
  });
});
