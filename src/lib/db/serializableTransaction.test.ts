import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const transaction = vi.fn();

vi.mock('./client', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import {
  isRetriableTransactionError,
  runSerializableTransaction,
  SERIALIZABLE_TRANSACTION_MAX_RETRIES,
} from './serializableTransaction';

describe('isRetriableTransactionError', () => {
  it('retries only Prisma serialization/write-conflict P2034', () => {
    expect(isRetriableTransactionError({ code: 'P2034' })).toBe(true);
  });

  it('does not retry unique constraints, transaction API, or unrelated errors', () => {
    expect(isRetriableTransactionError({ code: 'P2002' })).toBe(false);
    expect(isRetriableTransactionError({ code: 'P2028' })).toBe(false);
    expect(isRetriableTransactionError({ code: 'P2025' })).toBe(false);
    expect(isRetriableTransactionError(new Error('boom'))).toBe(false);
    expect(isRetriableTransactionError(null)).toBe(false);
  });
});

describe('runSerializableTransaction', () => {
  beforeEach(() => {
    transaction.mockReset();
  });

  it('uses Serializable isolation', async () => {
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => fn({}));
    const result = await runSerializableTransaction(async () => 'ok');
    expect(result).toBe('ok');
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('retries bounded write conflicts then succeeds', async () => {
    transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValueOnce('done');

    await expect(runSerializableTransaction(async () => 'done')).resolves.toBe('done');
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('stops after max retries on persistent serialization failure', async () => {
    transaction.mockRejectedValue({ code: 'P2034' });

    await expect(runSerializableTransaction(async () => 'x')).rejects.toEqual({ code: 'P2034' });
    expect(transaction).toHaveBeenCalledTimes(SERIALIZABLE_TRANSACTION_MAX_RETRIES);
  });

  it('does not retry non-retriable errors', async () => {
    transaction.mockRejectedValue({ code: 'P2025' });

    await expect(runSerializableTransaction(async () => 'x')).rejects.toEqual({ code: 'P2025' });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
