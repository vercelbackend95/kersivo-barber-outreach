import { describe, expect, it } from 'vitest';

import { CalibrationBudgetLedger } from './CalibrationBudgetLedger';

describe('CalibrationBudgetLedger', () => {
  const modelId = 'gpt-4o-mini-2024-07-18';

  it('blocks request N+1 at call ceiling', () => {
    const ledger = new CalibrationBudgetLedger(2, 100, modelId);
    expect(ledger.reserve('classify_service')).not.toBeNull();
    expect(ledger.reserve('classify_product')).not.toBeNull();
    expect(ledger.reserve('rerank')).toBeNull();
    expect(ledger.snapshot().requestCount).toBe(2);
  });

  it('blocks reservation when conservative cost ceiling exceeded', () => {
    const ledger = new CalibrationBudgetLedger(100, 0.0001, modelId);
    expect(ledger.reserve('classify_service')).toBeNull();
  });

  it('blocks next reservation when observed cost exceeds reservation and ceiling would be exceeded', () => {
    const ledger = new CalibrationBudgetLedger(10, 0.01, modelId);
    const first = ledger.reserve('classify_service');
    expect(first).not.toBeNull();
    ledger.recordObservedCost(0.02);
    expect(ledger.snapshot().consumedUsd).toBe(0.02);
    expect(ledger.reserve('classify_product')).toBeNull();
  });
});
