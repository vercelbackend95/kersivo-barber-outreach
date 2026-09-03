import { describe, expect, it } from 'vitest';

import type { RerankTransport } from './schemas';
import { validateRerankTransport } from './rerankValidation';

const SERVICE_ID = 'svc-1';
const CANDIDATES = ['prod-a', 'prod-b', 'prod-c'];

function makeRerank(overrides: Partial<RerankTransport> = {}): RerankTransport {
  return {
    schemaVersion: '1',
    serviceId: SERVICE_ID,
    orderedProductIds: [...CANDIDATES],
    confidence: 0.8,
    evidenceCodes: ['MATCH'],
    warnings: [],
    ...overrides,
  };
}

describe('validateRerankTransport', () => {
  it('accepts a valid complete permutation', () => {
    const result = validateRerankTransport(makeRerank(), SERVICE_ID, CANDIDATES);
    expect(result).toEqual({ ok: true, orderedProductIds: CANDIDATES });
  });

  it('rejects wrong schema version', () => {
    const result = validateRerankTransport(
      makeRerank({ schemaVersion: '2' as '1' }),
      SERVICE_ID,
      CANDIDATES,
    );
    expect(result).toEqual({ ok: false, code: 'INVALID_RERANK_SCHEMA_VERSION' });
  });

  it('rejects service id mismatch', () => {
    const result = validateRerankTransport(makeRerank({ serviceId: 'other' }), SERVICE_ID, CANDIDATES);
    expect(result).toEqual({ ok: false, code: 'RERANK_SERVICE_ID_MISMATCH' });
  });

  it('rejects unknown product id', () => {
    const result = validateRerankTransport(
      makeRerank({ orderedProductIds: ['prod-a', 'prod-b', 'prod-unknown'] }),
      SERVICE_ID,
      CANDIDATES,
    );
    expect(result).toEqual({ ok: false, code: 'RERANK_UNKNOWN_PRODUCT_ID' });
  });

  it('rejects duplicate product ids', () => {
    const result = validateRerankTransport(
      makeRerank({ orderedProductIds: ['prod-a', 'prod-a', 'prod-c'] }),
      SERVICE_ID,
      CANDIDATES,
    );
    expect(result).toEqual({ ok: false, code: 'RERANK_DUPLICATE_PRODUCT_ID' });
  });

  it('rejects omitted candidate', () => {
    const result = validateRerankTransport(
      makeRerank({ orderedProductIds: ['prod-a', 'prod-b'] }),
      SERVICE_ID,
      CANDIDATES,
    );
    expect(result).toEqual({ ok: false, code: 'RERANK_INCOMPLETE_PERMUTATION' });
  });

  it('rejects extra product id', () => {
    const result = validateRerankTransport(
      makeRerank({ orderedProductIds: ['prod-a', 'prod-b', 'prod-c', 'prod-extra'] }),
      SERVICE_ID,
      CANDIDATES,
    );
    expect(result).toEqual({ ok: false, code: 'RERANK_INCOMPLETE_PERMUTATION' });
  });
});
