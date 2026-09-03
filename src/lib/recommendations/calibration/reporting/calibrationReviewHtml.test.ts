import { describe, expect, it } from 'vitest';

import { buildCalibrationReviewHtml, escapeHtml } from './calibrationReviewHtml';
import { minimalReport } from './testReportFixtures';

describe('calibrationReviewHtml', () => {
  it('escapes HTML in catalogue-provided strings', () => {
    const html = buildCalibrationReviewHtml(minimalReport());
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>evil</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('DRY-RUN / STUB DATA');
  });

  it('escapeHtml neutralizes dangerous characters', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeHtml('"quoted" & \'single\'')).toBe('&quot;quoted&quot; &amp; &#39;single&#39;');
  });

  it('includes approval-critical live diagnostics', () => {
    const html = buildCalibrationReviewHtml(
      minimalReport({
        mode: 'live',
        operationAccountingReconciliation: { ok: true, errors: [] },
        recommendationMetrics: {
          ...minimalReport().recommendationMetrics,
          expectedEmptyPassRate: 1,
          expectedEmptyScenarioCount: 1,
          expectedEmptyScenariosPassed: 1,
        },
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
      }),
    );

    expect(html).toContain('Operation accounting');
    expect(html).toContain('Expected-empty scenarios');
    expect(html).toContain('Correct empty rail');
    expect(html).toContain('expected-empty pass rate');
    expect(html).toContain('Classification metrics (live)');
    expect(html).toContain('Recommendation metrics (live)');
  });
});
