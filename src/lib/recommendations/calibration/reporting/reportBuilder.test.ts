import { describe, expect, it } from 'vitest';

import type { CalibrationReport } from '../types';
import { buildCalibrationMarkdown } from './reportBuilder';
import { minimalReport } from './testReportFixtures';

describe('buildCalibrationMarkdown', () => {
  it('includes approval-critical live diagnostics', () => {
    const report = minimalReport({
      mode: 'live',
      liveEvaluationStatus: 'PASSED',
      releaseGateStatus: 'PASSED',
      finalOutcome: 'PASS',
      operationAccountingReconciliation: { ok: true, errors: [] },
      errorCodeCounts: { BUDGET_EXCEEDED: 1 },
      skipReasonCounts: { SPENDING_STOPPED_AUTH: 2 },
      invalidCacheDiagnostics: [{ entityId: 'cal-prod-x', operation: 'classify_product', reason: 'schema mismatch' }],
      missingProfileDiagnostics: [{ entityId: 'cal-svc-x', entityType: 'SERVICE', errorCode: 'OPENAI_AUTH_ERROR' }],
      operationBreakdown: [
        { kind: 'classify_service', entityId: 'cal-svc-skin-fade', status: 'provider_attempted' },
      ],
      recommendationMetrics: {
        ...minimalReport().recommendationMetrics,
        precisionAt4: 1,
        expectedEmptyScenarioCount: 1,
        expectedEmptyScenariosPassed: 1,
        expectedEmptyPassRate: 1,
        deterministicRepeatability: 1,
      },
      releaseGates: [
        {
          id: 'expected-empty-pass-rate',
          label: 'Expected-empty pass rate',
          threshold: '100%',
          actual: '100.0%',
          passed: true,
        },
      ],
      scenarioDiagnostics: [
        {
          scenarioId: 'gifting-not-wildcard',
          serviceId: 'cal-svc-buzz-cut',
          serviceName: 'Buzz Cut',
          serviceDescription: null,
          selectedProducts: [],
          pairAssertionResults: [],
          precisionAt4: 0,
          pass: true,
          failureReasons: [],
          expectEmpty: true,
          emptyRailMessage: 'Correct empty rail — no compatible products selected',
        },
      ],
    });

    const markdown = buildCalibrationMarkdown(report);
    expect(markdown).toContain('Operation accounting reconciliation');
    expect(markdown).toContain('Expected-empty scenarios');
    expect(markdown).toContain('Correct empty rail — no compatible products selected');
    expect(markdown).toContain('expected-empty pass rate');
    expect(markdown).toContain('BUDGET_EXCEEDED');
    expect(markdown).toContain('SPENDING_STOPPED_AUTH');
    expect(markdown).toContain('schema mismatch');
    expect(markdown).toContain('OPENAI_AUTH_ERROR');
    expect(markdown).toContain('Rerank attempted (provider)');
    expect(markdown).toContain('Taxonomy version');
    expect(markdown).toContain('Classification metrics (live model)');
  });
});
