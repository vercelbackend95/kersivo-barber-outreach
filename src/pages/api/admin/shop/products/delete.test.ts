import { beforeEach, describe, expect, it, vi } from 'vitest';

const runSerializableTransaction = vi.fn();
const scheduleCatalogueRebuild = vi.fn();
const requireAdminPermission = vi.fn();

vi.mock('../../../../../lib/admin/auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));

vi.mock('../../../../../lib/db/serializableTransaction', () => ({
  runSerializableTransaction: (...args: unknown[]) => runSerializableTransaction(...args),
}));

vi.mock('@/lib/recommendations/scheduleCatalogueRebuild', () => ({
  scheduleCatalogueRebuild: (...args: unknown[]) => scheduleCatalogueRebuild(...args),
}));

import { POST } from './delete';

function ctx(body: Record<string, unknown>) {
  return {
    request: new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  } as never;
}

describe('admin product delete recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermission.mockResolvedValue({ shopId: 'shop-1' });
  });

  it('blocks deletion when order history exists', async () => {
    runSerializableTransaction.mockImplementation(async (fn: (tx: {
      product: { findFirst: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
      orderItem: { count: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) => {
      const tx = {
        product: {
          findFirst: vi.fn().mockResolvedValue({ id: 'p-1' }),
          delete: vi.fn(),
        },
        orderItem: { count: vi.fn().mockResolvedValue(2) },
      };
      return fn(tx);
    });

    const res = await POST(ctx({ id: 'p-1' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('past orders');
    expect(scheduleCatalogueRebuild).not.toHaveBeenCalled();
  });

  it('allows deletion when only recommendation-derived references would have existed', async () => {
    runSerializableTransaction.mockImplementation(async (fn: (tx: {
      product: {
        findFirst: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
      orderItem: { count: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) => {
      const tx = {
        product: {
          findFirst: vi.fn().mockResolvedValue({ id: 'p-1' }),
          delete: vi.fn().mockResolvedValue({ id: 'p-1' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        orderItem: { count: vi.fn().mockResolvedValue(0) },
      };
      return fn(tx);
    });

    const res = await POST(ctx({ id: 'p-1' }));
    expect(res.status).toBe(200);
    expect(scheduleCatalogueRebuild).toHaveBeenCalled();
  });
});
