import { describe, expect, it } from 'vitest';

import { OperationAccounting } from './operationAccounting';
import type { LiveCallOperation } from './buildLiveCallPlan';

const OPS: LiveCallOperation[] = [
  { kind: 'classify_service', entityId: 's1' },
  { kind: 'classify_product', entityId: 'p1' },
  { kind: 'rerank', serviceId: 's1' },
];

describe('OperationAccounting', () => {
  it('reconciles attempted, cache hit, and skipped operations', () => {
    const accounting = new OperationAccounting(OPS);
    accounting.setState(OPS[0]!, { status: 'provider_attempted', success: true });
    accounting.setState(OPS[1]!, { status: 'cache_hit' });
    accounting.setState(OPS[2]!, { status: 'skipped', reason: 'SPENDING_STOPPED_AUTH' });

    const result = accounting.reconcile({
      plannedMax: 3,
      attempted: 1,
      successful: 1,
      failed: 0,
      cacheHits: 1,
      skipped: 1,
      rerankAttempted: 0,
    });

    expect(result.ok).toBe(true);
    expect(accounting.getBreakdown()).toHaveLength(3);
  });

  it('does not count cached or skipped rerank as rerankAttempted', () => {
    const accounting = new OperationAccounting(OPS);
    accounting.setState(OPS[0]!, { status: 'cache_hit' });
    accounting.setState(OPS[1]!, { status: 'skipped', reason: 'BUDGET_EXCEEDED' });
    accounting.setState(OPS[2]!, { status: 'provider_attempted', success: true });

    const result = accounting.reconcile({
      plannedMax: 3,
      attempted: 1,
      successful: 1,
      failed: 0,
      cacheHits: 1,
      skipped: 1,
      rerankAttempted: 1,
    });

    expect(result.ok).toBe(true);
  });

  it('fails reconciliation when counters disagree', () => {
    const accounting = new OperationAccounting(OPS);
    accounting.setState(OPS[0]!, { status: 'provider_attempted', success: true });
    accounting.setState(OPS[1]!, { status: 'cache_hit' });
    accounting.setState(OPS[2]!, { status: 'skipped', reason: 'SPENDING_STOPPED_AUTH' });

    const result = accounting.reconcile({
      plannedMax: 3,
      attempted: 99,
      successful: 1,
      failed: 0,
      cacheHits: 1,
      skipped: 1,
      rerankAttempted: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('attempted mismatch'))).toBe(true);
  });

  it('tracks skip reason counts', () => {
    const accounting = new OperationAccounting(OPS);
    accounting.setState(OPS[0]!, { status: 'skipped', reason: 'SPENDING_STOPPED_BILLING' });
    accounting.setState(OPS[1]!, { status: 'skipped', reason: 'SPENDING_STOPPED_BILLING' });
    accounting.setState(OPS[2]!, { status: 'skipped', reason: 'BUDGET_EXCEEDED' });

    expect(accounting.getSkipReasonCounts()).toEqual({
      SPENDING_STOPPED_BILLING: 2,
      BUDGET_EXCEEDED: 1,
    });
  });
});
