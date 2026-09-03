export type CalibrationBudgetLedgerSnapshot = {
  requestCount: number;
  reservedUsd: number;
  observedUsd: number;
  consumedUsd: number;
  remainingCalls: number;
  remainingUsd: number;
  maxCalls: number;
  maxCostUsd: number;
};
