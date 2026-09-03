import type { CalibrationReport } from '../types';

export function formatRecommendationMetricsBlock(report: CalibrationReport): string {
  const rec = report.recommendationMetrics;
  const emptyRate =
    rec.expectedEmptyPassRate == null ? 'N/A' : `${(rec.expectedEmptyPassRate * 100).toFixed(1)}%`;
  return [
    `| precision@4 | ${rec.precisionAt4 == null ? 'N/A' : `${(rec.precisionAt4 * 100).toFixed(1)}%`} |`,
    `| mustInclude recall | ${rec.mustIncludeRecall == null ? 'N/A' : `${(rec.mustIncludeRecall * 100).toFixed(1)}%`} |`,
    `| mustExclude pass | ${rec.mustExcludePassRate == null ? 'N/A' : `${(rec.mustExcludePassRate * 100).toFixed(1)}%`} |`,
    `| deterministic repeatability | ${rec.deterministicRepeatability == null ? 'N/A' : `${(rec.deterministicRepeatability * 100).toFixed(1)}%`} |`,
    `| expected-empty pass rate | ${emptyRate} |`,
    `| expected-empty scenarios passed | ${rec.expectedEmptyScenariosPassed}/${rec.expectedEmptyScenarioCount} |`,
    `| pair assertion pass | ${rec.pairAssertionPassRate == null ? 'N/A' : `${(rec.pairAssertionPassRate * 100).toFixed(1)}%`} |`,
    `| critical unsafe false positives | ${rec.criticalUnsafeFalsePositiveCount} |`,
    `| family-cap violations | ${rec.familyCapViolations} |`,
    `| rerank fallback rate | ${rec.rerankFallbackRate == null ? 'N/A' : `${(rec.rerankFallbackRate * 100).toFixed(1)}%`} |`,
  ].join('\n');
}

export function formatClassificationMetricsBlock(report: CalibrationReport): string {
  const cls = report.classificationMetrics;
  const rate = (value: number | null) => (value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`);
  return [
    `| structured parse success | ${rate(cls.structuredParseSuccessRate)} |`,
    `| required field accuracy | ${rate(cls.requiredFieldAccuracy)} |`,
    `| forbidden field violation rate | ${rate(cls.forbiddenFieldViolationRate)} |`,
    `| confidence gate correctness | ${rate(cls.confidenceGateCorrectness)} |`,
    `| ambiguous fail-closed rate | ${rate(cls.ambiguousFailClosedRate)} |`,
    `| evaluated entities | ${cls.evaluatedEntityCount} |`,
  ].join('\n');
}

export function formatOperationBreakdown(report: CalibrationReport): string {
  if (!report.operationBreakdown || report.operationBreakdown.length === 0) {
    return '- None';
  }
  return report.operationBreakdown
    .map((entry) => {
      const id = entry.entityId ?? entry.serviceId ?? 'unknown';
      const detail =
        entry.status === 'skipped'
          ? `${entry.status} (${entry.reason ?? 'unknown'})`
          : entry.status === 'provider_attempted' && entry.errorCode
            ? `${entry.status} (${entry.errorCode})`
            : entry.status;
      return `- **${entry.kind}** \`${id}\`: ${detail}`;
    })
    .join('\n');
}

export function formatErrorCodeCounts(report: CalibrationReport): string {
  const counts = report.errorCodeCounts ?? {};
  const entries = Object.entries(counts);
  if (entries.length === 0) return '- None';
  return entries.map(([code, count]) => `- **${code}**: ${count}`).join('\n');
}

export function formatExpectedEmptyScenarios(report: CalibrationReport): string {
  const scenarios = report.scenarioDiagnostics.filter((s) => s.expectEmpty);
  if (scenarios.length === 0) return '- None';
  return scenarios
    .map((scenario) => {
      const status = scenario.pass ? 'PASS' : 'FAIL';
      const message = scenario.emptyRailMessage ?? scenario.failureReasons.join('; ');
      return `- **${scenario.scenarioId}** (${status}): ${message}`;
    })
    .join('\n');
}

export function formatRerankFallbackReasons(report: CalibrationReport): string {
  const counts = report.rerankFallbackReasonCounts ?? {};
  const entries = Object.entries(counts);
  if (entries.length === 0) return '- None';
  return entries.map(([reason, count]) => `- **${reason}**: ${count}`).join('\n');
}
