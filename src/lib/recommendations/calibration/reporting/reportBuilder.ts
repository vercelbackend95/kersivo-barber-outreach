import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CalibrationCallPlan, CalibrationReport } from '../types';
import { buildCalibrationReviewHtml } from './calibrationReviewHtml';
import {
  formatClassificationMetricsBlock,
  formatErrorCodeCounts,
  formatExpectedEmptyScenarios,
  formatOperationBreakdown,
  formatRecommendationMetricsBlock,
  formatRerankFallbackReasons,
} from './reportSections';
import { sanitizeReport } from './sanitizeReport';

function collectIrrelevantProducts(report: CalibrationReport): Array<{
  scenarioId: string;
  productName: string;
  productId: string;
}> {
  const items: Array<{ scenarioId: string; productName: string; productId: string }> = [];
  for (const scenario of report.scenarioDiagnostics) {
    for (const product of scenario.selectedProducts) {
      if (!product.inRelevantProductIds) {
        items.push({
          scenarioId: scenario.scenarioId,
          productName: product.productName,
          productId: product.productId,
        });
      }
    }
  }
  return items;
}

export function buildCalibrationMarkdown(report: CalibrationReport): string {
  const gateLines = report.releaseGates
    .map((gate) => {
      const status = gate.notEvaluated ? 'NOT_EVALUATED' : gate.skipped ? 'SKIP' : gate.passed ? 'PASS' : 'FAIL';
      return `| ${gate.label} | ${gate.threshold} | ${gate.actual} | ${status} |`;
    })
    .join('\n');

  const fixture = report.harnessFixtureMetrics;
  const irrelevant = collectIrrelevantProducts(report);
  const failingScenarios = report.scenarioDiagnostics.filter((s) => !s.pass);

  const irrelevantLines =
    irrelevant.length === 0
      ? '- None'
      : irrelevant
          .map((i) => `- **${i.scenarioId}**: ${i.productName} (\`${i.productId}\`)`)
          .join('\n');

  const failingLines =
    failingScenarios.length === 0
      ? '- None'
      : failingScenarios
          .map((s) => `- **${s.scenarioId}**: ${s.failureReasons.join('; ')}`)
          .join('\n');

  const thresholdLines =
    report.harnessFixtureChecks.fixtureThresholdFailures.length === 0
      ? '- None'
      : report.harnessFixtureChecks.fixtureThresholdFailures.map((f) => `- ${f}`).join('\n');

  const reconciliation = report.operationAccountingReconciliation;
  const reconciliationStatus = reconciliation
    ? reconciliation.ok
      ? 'PASS'
      : `FAIL — ${reconciliation.errors.join('; ')}`
    : 'NOT_RUN';

  const skipLines =
    report.skipReasonCounts && Object.keys(report.skipReasonCounts).length > 0
      ? Object.entries(report.skipReasonCounts)
          .map(([k, v]) => `- **${k}**: ${v}`)
          .join('\n')
      : '- None';

  const invalidCacheLines =
    report.invalidCacheDiagnostics && report.invalidCacheDiagnostics.length > 0
      ? report.invalidCacheDiagnostics
          .map((d) => `- **${d.entityId}** (${d.operation}): ${d.reason}`)
          .join('\n')
      : '- None';

  const missingProfileLines =
    report.missingProfileDiagnostics && report.missingProfileDiagnostics.length > 0
      ? report.missingProfileDiagnostics
          .map((d) => `- **${d.entityId}** (${d.entityType}): ${d.errorCode}`)
          .join('\n')
      : '- None';

  const modeBanner =
    report.mode === 'live'
      ? '**LIVE MODEL OUTPUT — FICTIONAL CALIBRATION DATASET.** This report reflects OpenAI classifier output on fictional catalogue entities. No customer data.'
      : 'Dry-run validates harness infrastructure and deterministic fixture contracts only. Live model quality gates are **not evaluated** until a live calibration run.';

  return `# Smart Retail Calibration Report

- **Run ID:** ${report.runId}
- **Timestamp (UTC):** ${report.timestampUtc}
- **Mode:** ${report.mode}
- **Scope:** ${report.scope}
- **Model:** ${report.modelId}
- **Taxonomy version:** ${report.taxonomyVersion}
- **Schema version:** ${report.schemaVersion}
- **Prompt version:** ${report.promptVersion}
- **Dataset version:** ${report.datasetVersion}
${report.gitSha ? `- **Git SHA:** ${report.gitSha}` : ''}
${report.finalOutcome ? `- **Final outcome:** ${report.finalOutcome}` : ''}

## Status

| Check | Status |
|-------|--------|
| Harness self-check | ${report.harnessSelfCheckStatus} |
| Live evaluation | ${report.liveEvaluationStatus} |
| Release gates | ${report.releaseGateStatus} |
| Operation accounting reconciliation | ${reconciliationStatus} |

${modeBanner}

## Dataset (scope)

| Metric | Count |
|--------|------:|
| Services | ${report.datasetCounts.services} |
| Products | ${report.datasetCounts.products} |
| Scenarios | ${report.datasetCounts.scenarios} |

## Calls & cost

| Metric | Value |
|--------|------:|
| Planned max calls | ${report.calls.plannedMax} |
| Attempted | ${report.calls.attempted} |
| Successful | ${report.calls.successful} |
| Failed | ${report.calls.failed} |
| Cache hits | ${report.calls.cacheHits} |
| Skipped | ${report.calls.skipped} |
| Rerank attempted (provider) | ${report.calls.rerankAttempted} |
| Rerank applied | ${report.calls.rerankApplied} |
| Rerank fallback | ${report.calls.rerankFallback} |
| Prompt tokens (known calls) | ${report.tokens.prompt} |
| Completion tokens (known calls) | ${report.tokens.completion} |
| Total tokens (known calls) | ${report.tokens.total} |
| Known-usage calls | ${report.tokens.knownCallCount ?? 0} |
| Unknown-usage calls | ${report.tokens.unknownCallCount ?? 0} |
| Est. max cost (USD) | $${report.cost.estimatedMaxUsd.toFixed(4)} |
| Reserved max cost (USD) | $${report.cost.reservedMaxUsd.toFixed(4)} |
| Observed cost (USD) | ${report.cost.observedUsdKnown && report.cost.observedUsd != null ? `$${report.cost.observedUsd.toFixed(4)}` : 'unknown'} |

## Operation breakdown

${formatOperationBreakdown(report)}

## Error code counts

${formatErrorCodeCounts(report)}

## Skip reason counts

${skipLines}

## Invalid cache diagnostics

${invalidCacheLines}

## Missing profile diagnostics

${missingProfileLines}

## Classification metrics (live model)

| Metric | Value |
|--------|------:|
${formatClassificationMetricsBlock(report)}

## Recommendation metrics (live model)

| Metric | Value |
|--------|------:|
${formatRecommendationMetricsBlock(report)}

## Rerank fallback reasons

${formatRerankFallbackReasons(report)}

## Hand-authored fixture self-check — not OpenAI output

| Metric | Value |
|--------|------:|
| precision@4 | ${(fixture.precisionAt4 * 100).toFixed(1)}% |
| mustInclude recall | ${(fixture.mustIncludeRecall * 100).toFixed(1)}% |
| mustExclude pass | ${(fixture.mustExcludePassRate * 100).toFixed(1)}% |
| critical unsafe false positives | ${fixture.criticalUnsafeFalsePositiveCount} |
| pair assertion pass | ${(fixture.pairAssertionPassRate * 100).toFixed(1)}% |
| deterministic repeatability | ${(fixture.deterministicRepeatability * 100).toFixed(1)}% |
| family-cap violations | ${fixture.familyCapViolations} |
| combo domain coverage | ${fixture.comboDomainCoverageRate == null ? 'N/A' : `${(fixture.comboDomainCoverageRate * 100).toFixed(1)}%`} |

- Classification expectations: ${report.harnessFixtureChecks.classificationExpectationsPassed}/${report.harnessFixtureChecks.classificationExpectationsTotal}
- Recommendation scenarios: ${report.harnessFixtureChecks.recommendationScenariosPassed}/${report.harnessFixtureChecks.recommendationScenariosTotal}
- Pair assertions: ${report.harnessFixtureChecks.pairAssertionsPassed}/${report.harnessFixtureChecks.pairAssertionsTotal}

### Fixture threshold failures

${thresholdLines}

### Irrelevant selected products (top-4, not in relevantProductIds)

${irrelevantLines}

### Failing scenarios

${failingLines}

### Expected-empty scenarios

${formatExpectedEmptyScenarios(report)}

## Release gates (live model — ${report.liveEvaluationStatus})

| Gate | Threshold | Actual | Status |
|------|-----------|--------|--------|
${gateLines}
`;
}

export async function writeCalibrationReport(
  outputDir: string,
  report: CalibrationReport,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const sanitized = sanitizeReport(report);
  const jsonPath = join(outputDir, 'calibration-report.json');
  const mdPath = join(outputDir, 'calibration-report.md');
  const htmlPath = join(outputDir, 'calibration-review.html');
  await writeFile(jsonPath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, `${buildCalibrationMarkdown(sanitized)}\n`, 'utf8');
  await writeFile(htmlPath, `${buildCalibrationReviewHtml(sanitized)}\n`, 'utf8');
}

export function summarizeCallPlan(plan: CalibrationCallPlan): string {
  return [
    `scope: ${plan.scope}`,
    `service classifications: ${plan.serviceClassifications}`,
    `product classifications: ${plan.productClassifications}`,
    `rerank attempts: ${plan.rerankAttempts}`,
    `total max calls: ${plan.totalMaxCalls}`,
    `estimated tokens: ${plan.estimatedInputTokens + plan.estimatedOutputTokens}`,
    `estimated max cost (USD): $${plan.estimatedMaxCostUsd.toFixed(4)}`,
  ].join('\n');
}
