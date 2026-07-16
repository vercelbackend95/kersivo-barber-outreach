import { Prisma } from '@prisma/client';

import { prisma } from './client';

const MAX_TRANSACTION_RETRIES = 3;
const TRANSACTION_MAX_WAIT_MS = 10_000;
const TRANSACTION_TIMEOUT_MS = 15_000;

function isRetriableTransactionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const code = String((error as { code?: string }).code ?? '');
  return code === 'P2002' || code === 'P2034' || code === 'P2028';
}

export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let attempt = 0;

  while (attempt < MAX_TRANSACTION_RETRIES) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      });
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_TRANSACTION_RETRIES || !isRetriableTransactionError(error)) {
        throw error;
      }
    }
  }

  throw new Error('Unable to complete transaction.');
}
