import { estimateCostFromTokens, TOKEN_ASSUMPTIONS } from '../costEstimator';
import type { CalibrationBudgetLedgerSnapshot } from './types';

export type BudgetOperation = 'classify_service' | 'classify_product' | 'rerank';

export type BudgetReservation = {
  operation: BudgetOperation;
  reservedUsd: number;
};

export class CalibrationBudgetLedger {
  private requestCount = 0;
  private reservedUsd = 0;
  private observedUsd = 0;

  constructor(
    private readonly maxCalls: number,
    private readonly maxCostUsd: number,
    private readonly modelId: string,
  ) {}

  private consumedUsd(): number {
    return Math.max(this.reservedUsd, this.observedUsd);
  }

  reserve(operation: BudgetOperation): BudgetReservation | null {
    if (this.requestCount + 1 > this.maxCalls) {
      return null;
    }

    const tokens = TOKEN_ASSUMPTIONS[
      operation === 'classify_service'
        ? 'classifyService'
        : operation === 'classify_product'
          ? 'classifyProduct'
          : 'rerank'
    ];
    const reservedUsd = estimateCostFromTokens(this.modelId, tokens.input, tokens.output);
    if (this.consumedUsd() + reservedUsd > this.maxCostUsd) {
      return null;
    }

    this.requestCount += 1;
    this.reservedUsd += reservedUsd;
    return { operation, reservedUsd };
  }

  recordObservedCost(usd: number): void {
    if (!Number.isFinite(usd) || usd < 0) return;
    this.observedUsd += usd;
  }

  snapshot(): CalibrationBudgetLedgerSnapshot {
    const consumed = this.consumedUsd();
    return {
      requestCount: this.requestCount,
      reservedUsd: this.reservedUsd,
      observedUsd: this.observedUsd,
      consumedUsd: consumed,
      remainingCalls: Math.max(0, this.maxCalls - this.requestCount),
      remainingUsd: Math.max(0, this.maxCostUsd - consumed),
      maxCalls: this.maxCalls,
      maxCostUsd: this.maxCostUsd,
    };
  }
}
