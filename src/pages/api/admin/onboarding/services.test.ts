import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOnboardingAccess = vi.fn();
const linkAllServicesToAllBarbers = vi.fn();
const advanceOnboardingStep = vi.fn();
const loadOnboardingState = vi.fn();
const scheduleCatalogueRebuild = vi.fn();
const prismaTransaction = vi.fn();
const prismaServiceFindMany = vi.fn();

vi.mock('@/lib/admin/onboarding', () => ({
  requireOnboardingAccess: (...args: unknown[]) => requireOnboardingAccess(...args),
  linkAllServicesToAllBarbers: (...args: unknown[]) => linkAllServicesToAllBarbers(...args),
  advanceOnboardingStep: (...args: unknown[]) => advanceOnboardingStep(...args),
  loadOnboardingState: (...args: unknown[]) => loadOnboardingState(...args),
  ONBOARDING_STEP_HOURS: 'hours',
  GUEST_ONBOARDING_VIEWER: { role: 'guest' },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: {
      findMany: (...args: unknown[]) => prismaServiceFindMany(...args),
    },
    $transaction: (...args: unknown[]) => prismaTransaction(...args),
  },
}));

vi.mock('@/lib/recommendations/scheduleCatalogueRebuild', () => ({
  scheduleCatalogueRebuild: (...args: unknown[]) => scheduleCatalogueRebuild(...args),
}));

import { PUT as adminPut } from './services';

vi.mock('@/lib/preview/shopPreviewSession', () => ({
  PREVIEW_WRITE_RATE: { action: 'preview_write', limit: 10, windowMs: 60_000 },
  requirePreviewOnboardingAccess: vi.fn(),
}));

vi.mock('@/lib/rate-limit/enforceIpRateLimit', () => ({
  enforceIpRateLimit: vi.fn().mockResolvedValue(null),
}));

import { PUT as previewPut } from '../../preview/onboarding/services';
import { requirePreviewOnboardingAccess } from '@/lib/preview/shopPreviewSession';

const previewAccess = vi.mocked(requirePreviewOnboardingAccess);

function ctx(body: Record<string, unknown>) {
  return {
    request: new Request('http://localhost/api/admin/onboarding/services', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never;
}

describe('admin onboarding services recommendation rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOnboardingAccess.mockResolvedValue({ shopId: 'shop-1' });
    loadOnboardingState.mockResolvedValue({ step: 'hours' });
    linkAllServicesToAllBarbers.mockResolvedValue(undefined);
    advanceOnboardingStep.mockResolvedValue(undefined);
    scheduleCatalogueRebuild.mockResolvedValue(undefined);
  });

  it('schedules catalogue rebuild once after creating services', async () => {
    prismaServiceFindMany.mockResolvedValue([]);
    const tx = {
      service: {
        create: vi.fn().mockResolvedValue({ id: 'svc-new' }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    prismaTransaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => fn(tx));

    const res = await adminPut(
      ctx({
        services: [{ name: 'Skin Fade', pricePence: 2500, durationMinutes: 45, selected: true }],
      }),
    );

    expect(res.status).toBe(200);
    expect(tx.service.create).toHaveBeenCalledTimes(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledTimes(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledWith('shop-1', tx);
  });

  it('schedules catalogue rebuild once after renaming a service', async () => {
    prismaServiceFindMany.mockResolvedValue([{ id: 'svc-1' }]);
    const tx = {
      service: {
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'svc-1' }),
        updateMany: vi.fn(),
      },
    };
    prismaTransaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => fn(tx));

    const res = await adminPut(
      ctx({
        services: [
          { id: 'svc-1', name: 'Skin Fade Plus', pricePence: 2800, durationMinutes: 45, selected: true },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(tx.service.update).toHaveBeenCalledTimes(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledTimes(1);
    expect(scheduleCatalogueRebuild).toHaveBeenCalledWith('shop-1', tx);
  });

  it('schedules catalogue rebuild once after deactivating omitted services', async () => {
    prismaServiceFindMany.mockResolvedValue([{ id: 'svc-keep' }, { id: 'svc-drop' }]);
    const tx = {
      service: {
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'svc-keep' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prismaTransaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) => fn(tx));

    const res = await adminPut(
      ctx({
        services: [
          { id: 'svc-keep', name: 'Skin Fade', pricePence: 2500, durationMinutes: 45, selected: true },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(tx.service.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['svc-drop'] }, shopId: 'shop-1' },
        data: { isActive: false },
      }),
    );
    expect(scheduleCatalogueRebuild).toHaveBeenCalledTimes(1);
  });

  it('does not schedule rebuild when the transaction rolls back', async () => {
    prismaServiceFindMany.mockResolvedValue([]);
    prismaTransaction.mockImplementation(async (fn: (client: {
      service: { create: ReturnType<typeof vi.fn> };
    }) => Promise<void>) => {
      const tx = {
        service: {
          create: vi.fn().mockRejectedValue(new Error('db failed')),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
      };
      await fn(tx);
    });

    const res = await adminPut(
      ctx({
        services: [{ name: 'Skin Fade', pricePence: 2500, durationMinutes: 45, selected: true }],
      }),
    );

    expect(res.status).toBe(500);
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });
});

describe('preview onboarding services recommendation rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewAccess.mockResolvedValue({ shopId: 'preview-shop-1' } as never);
    loadOnboardingState.mockResolvedValue({ step: 'hours' });
    linkAllServicesToAllBarbers.mockResolvedValue(undefined);
    advanceOnboardingStep.mockResolvedValue(undefined);
    prismaServiceFindMany.mockResolvedValue([]);
    prismaTransaction.mockImplementation(async (fn: (tx: {
      service: {
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
    }) => Promise<void>) => {
      await fn({
        service: {
          create: vi.fn().mockResolvedValue({ id: 'svc-preview' }),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
      });
    });
  });

  it('does not schedule production recommendation work', async () => {
    const res = await previewPut(
      ctx({
        services: [{ name: 'Trim', pricePence: 1500, durationMinutes: 30, selected: true }],
      }),
    );

    expect(res.status).toBe(200);
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });
});
