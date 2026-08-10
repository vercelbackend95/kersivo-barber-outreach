import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { permissionsForRole } from '@/lib/admin/rbac/permissions';

const requireAdminPermission = vi.fn();

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return {
    ...actual,
    requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
  };
});

const findUniqueShop = vi.fn();
const findFirstOrder = vi.fn();
const findManyProducts = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => findUniqueShop(...args),
    },
    order: {
      findFirst: (...args: unknown[]) => findFirstOrder(...args),
    },
    product: {
      findMany: (...args: unknown[]) => findManyProducts(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { POST, previewTestOrderCustomerEmail } from './test-order';

function makeContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/shop/test-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

function ownerAccess(overrides: Record<string, unknown> = {}) {
  return {
    shopId: 'shop-1',
    userId: 'user-1',
    userName: 'Owner',
    userEmail: 'owner@example.com',
    emailVerified: true,
    userImage: null,
    via: 'session' as const,
    role: 'OWNER' as const,
    memberId: 'member-1',
    barberId: null,
    permissions: permissionsForRole('OWNER'),
    ...overrides,
  };
}

describe('POST /api/admin/shop/test-order', () => {
  beforeEach(() => {
    requireAdminPermission.mockReset();
    findUniqueShop.mockReset();
    findFirstOrder.mockReset();
    findManyProducts.mockReset();
    transaction.mockReset();
  });

  it('rejects secret via', async () => {
    requireAdminPermission.mockResolvedValue(ownerAccess({ via: 'secret', userEmail: null }));

    const res = await POST(makeContext({ items: [{ productId: 'p1', quantity: 1 }] }));
    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates a test order for preview via with synthetic email', async () => {
    const shopId = 'preview-shop-9';
    requireAdminPermission.mockResolvedValue(
      ownerAccess({
        via: 'preview',
        shopId,
        userId: null,
        userEmail: null,
        memberId: null,
      }),
    );
    findUniqueShop.mockResolvedValue({
      id: shopId,
      retailTestOrderId: null,
      retailTestOrderCompletedAt: null,
      retailPickupWalkthroughCompletedAt: null,
    });
    findManyProducts.mockResolvedValue([{ id: 'p1', name: 'Clay', pricePence: 1200 }]);
    const orderCreate = vi.fn().mockImplementation(async ({ data }: { data: { customerEmail: string } }) => ({
      id: 'order-preview-1',
      status: 'PAID',
      totalPence: 1200,
      isTestOrder: true,
      paidAt: new Date('2026-08-10T12:00:00.000Z'),
      customerEmail: data.customerEmail,
      items: [
        {
          productId: 'p1',
          nameSnapshot: 'Clay',
          unitPricePenceSnapshot: 1200,
          quantity: 1,
          lineTotalPence: 1200,
        },
      ],
    }));
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        shopSettings: {
          findUnique: vi.fn().mockResolvedValue({ retailTestOrderId: null }),
          update: vi.fn().mockResolvedValue({}),
        },
        order: { create: orderCreate },
      };
      return fn(tx);
    });

    const res = await POST(makeContext({ items: [{ productId: 'p1', quantity: 1 }] }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerEmail: previewTestOrderCustomerEmail(shopId),
          isTestOrder: true,
        }),
      }),
    );
    expect(json.order.customerEmail).toBe(previewTestOrderCustomerEmail(shopId));
  });

  it('builds a stable preview customer email from shopId', () => {
    expect(previewTestOrderCustomerEmail('abc')).toBe('preview-test+abc@kersivo.invalid');
  });
});
