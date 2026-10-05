import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminPermission = vi.fn();
const loadKersivoAccess = vi.fn();
const serviceFindFirst = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shop/kersivoAccess')>()),
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    service: {
      findFirst: (...args: unknown[]) => serviceFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

vi.mock('@/lib/recommendations/scheduleCatalogueRebuild', () => ({
  scheduleCatalogueRebuild: vi.fn(),
}));

import { accessForState } from '@/lib/shop/kersivoAccess';
import { POST } from './services';
import { PATCH } from './services/[id]';

const ownerAccess = {
  shopId: 'shop_1',
  userId: 'u1',
  role: 'OWNER',
  via: 'session',
  emailVerified: true,
};

function request(method: 'POST' | 'PATCH', body: Record<string, unknown>, id?: string) {
  return {
    params: id ? { id } : {},
    request: new Request('https://kersivo.co.uk/api/admin/services', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as never;
}

const baseCreate = {
  name: 'Haircut',
  pricePence: 499,
  durationMinutes: 30,
  bufferMinutes: 0,
  displayOrder: 0,
  category: 'Hair',
  featured: false,
  isActive: true,
  barberIds: [],
};

describe('v1.19 Starter service £5 public-booking floor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermission.mockResolvedValue(ownerAccess);
    loadKersivoAccess.mockResolvedValue(accessForState('FREE_BOOKING'));
  });

  it('rejects a crafted Starter create request for an active £4.99 service before any write', async () => {
    const res = await POST(request('POST', baseCreate));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'STARTER_SERVICE_PRICE_TOO_LOW' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects lowering an active Starter service below £5 before any write', async () => {
    serviceFindFirst.mockResolvedValue({
      id: 'svc_1',
      category: 'Hair',
      featured: false,
      name: 'Haircut',
      description: null,
      isActive: true,
      pricePence: 2500,
      imageUrl: null,
    });

    const res = await PATCH(request('PATCH', { pricePence: 499 }, 'svc_1'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'STARTER_SERVICE_PRICE_TOO_LOW' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects activating a pre-existing sub-£5 service on Starter', async () => {
    serviceFindFirst.mockResolvedValue({
      id: 'svc_low',
      category: 'Other',
      featured: false,
      name: 'Consultation',
      description: null,
      isActive: false,
      pricePence: 300,
      imageUrl: null,
    });

    const res = await PATCH(request('PATCH', { isActive: true }, 'svc_low'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'STARTER_SERVICE_PRICE_TOO_LOW' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not apply the Starter-specific floor to Full KERSIVO', async () => {
    loadKersivoAccess.mockResolvedValue(accessForState('FULL_KERSIVO'));
    transaction.mockRejectedValueOnce(new Error('reached-write-path'));

    await expect(POST(request('POST', baseCreate))).rejects.toThrow('reached-write-path');
    expect(transaction).toHaveBeenCalled();
  });
});
