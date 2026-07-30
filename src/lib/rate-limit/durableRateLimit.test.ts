import { describe, it, expect, vi, beforeEach } from 'vitest';

const count = vi.fn();
const findFirst = vi.fn();
const create = vi.fn();
const executeRaw = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: (...args: unknown[]) => executeRaw(...args),
        rateLimitEvent: {
          count: (...args: unknown[]) => count(...args),
          findFirst: (...args: unknown[]) => findFirst(...args),
          create: (...args: unknown[]) => create(...args),
        },
      };
      return fn(tx);
    },
    rateLimitEvent: {
      count: (...args: unknown[]) => count(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import { checkDurableRateLimit } from './durableRateLimit';

describe('checkDurableRateLimit', () => {
  beforeEach(() => {
    count.mockReset();
    findFirst.mockReset();
    create.mockReset();
    executeRaw.mockReset();
    create.mockResolvedValue({});
    executeRaw.mockResolvedValue(undefined);
  });

  it('records a hit when under limit', async () => {
    count.mockResolvedValue(2);
    findFirst.mockResolvedValue(null);

    const result = await checkDurableRateLimit({
      key: '1.2.3.4',
      action: 'contact_form',
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.ok).toBe(true);
    expect(executeRaw).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: { ip: '1.2.3.4', action: 'contact_form' },
    });
  });

  it('rejects when at or over limit', async () => {
    count.mockResolvedValue(5);
    findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 30_000) });

    const result = await checkDurableRateLimit({
      key: '1.2.3.4',
      action: 'contact_form',
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(create).not.toHaveBeenCalled();
  });
});
