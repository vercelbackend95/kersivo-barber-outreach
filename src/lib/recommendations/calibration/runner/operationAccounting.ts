import type { LiveCallOperation } from '../runner/buildLiveCallPlan';

export type OperationSkipReason =
  | 'SPENDING_STOPPED_AUTH'
  | 'SPENDING_STOPPED_BILLING'
  | 'BUDGET_EXCEEDED'
  | 'RERANK_POOL_INSUFFICIENT'
  | 'RERANK_SERVICE_PROFILE_MISSING'
  | 'CATALOGUE_SERVICE_MISSING'
  | 'CATALOGUE_PRODUCT_MISSING'
  | 'SPENDING_STOPPED';

export type OperationTerminalState =
  | { status: 'provider_attempted'; success: boolean; errorCode?: string }
  | { status: 'cache_hit' }
  | { status: 'skipped'; reason: OperationSkipReason };

export type OperationBreakdownEntry = {
  operation: LiveCallOperation;
  state: OperationTerminalState;
};

export function operationKey(operation: LiveCallOperation): string {
  if (operation.kind === 'rerank') return `rerank:${operation.serviceId}`;
  return `${operation.kind}:${operation.entityId}`;
}

export class OperationAccounting {
  private readonly states = new Map<string, OperationTerminalState>();
  private readonly operations: LiveCallOperation[];

  constructor(operations: LiveCallOperation[]) {
    this.operations = operations;
  }

  get expectedCount(): number {
    return this.operations.length;
  }

  setState(operation: LiveCallOperation, state: OperationTerminalState): void {
    this.states.set(operationKey(operation), state);
  }

  getState(operation: LiveCallOperation): OperationTerminalState | undefined {
    return this.states.get(operationKey(operation));
  }

  skipRemaining(fromIndex: number, reason: OperationSkipReason): void {
    for (let i = fromIndex; i < this.operations.length; i += 1) {
      const op = this.operations[i]!;
      const key = operationKey(op);
      if (!this.states.has(key)) {
        this.states.set(key, { status: 'skipped', reason });
      }
    }
  }

  getBreakdown(): OperationBreakdownEntry[] {
    return this.operations.map((operation) => ({
      operation,
      state: this.states.get(operationKey(operation)) ?? {
        status: 'skipped' as const,
        reason: 'SPENDING_STOPPED' as OperationSkipReason,
      },
    }));
  }

  getSkipReasonCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.getBreakdown()) {
      if (entry.state.status === 'skipped') {
        counts[entry.state.reason] = (counts[entry.state.reason] ?? 0) + 1;
      }
    }
    return counts;
  }

  reconcile(calls: {
    plannedMax: number;
    attempted: number;
    successful: number;
    failed: number;
    cacheHits: number;
    skipped: number;
    rerankAttempted: number;
  }): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    const breakdown = this.getBreakdown();

    if (breakdown.length !== this.expectedCount) {
      errors.push(`Expected ${this.expectedCount} operations, got ${breakdown.length}`);
    }

    if (this.expectedCount !== calls.plannedMax) {
      errors.push(`Planned operations mismatch: ${this.expectedCount} vs ${calls.plannedMax}`);
    }

    let attempted = 0;
    let successful = 0;
    let failed = 0;
    let cacheHits = 0;
    let skipped = 0;
    let rerankAttempted = 0;

    for (const entry of breakdown) {
      const { state, operation } = entry;
      if (state.status === 'cache_hit') {
        cacheHits += 1;
      } else if (state.status === 'provider_attempted') {
        attempted += 1;
        if (operation.kind === 'rerank') rerankAttempted += 1;
        if (state.success) successful += 1;
        else failed += 1;
      } else if (state.status === 'skipped') {
        skipped += 1;
      }
    }

    if (attempted + cacheHits + skipped !== this.expectedCount) {
      errors.push(
        `Terminal state sum mismatch: ${attempted + cacheHits + skipped} vs ${this.expectedCount}`,
      );
    }

    if (attempted !== calls.attempted) errors.push(`attempted mismatch: ${attempted} vs ${calls.attempted}`);
    if (successful !== calls.successful) errors.push(`successful mismatch: ${successful} vs ${calls.successful}`);
    if (failed !== calls.failed) errors.push(`failed mismatch: ${failed} vs ${calls.failed}`);
    if (cacheHits !== calls.cacheHits) errors.push(`cacheHits mismatch: ${cacheHits} vs ${calls.cacheHits}`);
    if (skipped !== calls.skipped) errors.push(`skipped mismatch: ${skipped} vs ${calls.skipped}`);
    if (rerankAttempted !== calls.rerankAttempted) {
      errors.push(`rerankAttempted mismatch: ${rerankAttempted} vs ${calls.rerankAttempted}`);
    }

    return { ok: errors.length === 0, errors };
  }
}
