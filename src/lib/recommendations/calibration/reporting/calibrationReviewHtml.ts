import type { CalibrationReport, ScenarioDiagnostic, ScenarioProductDiagnostic } from '../types';
import {
  formatClassificationMetricsBlock,
  formatErrorCodeCounts,
  formatExpectedEmptyScenarios,
  formatOperationBreakdown,
  formatRecommendationMetricsBlock,
  formatRerankFallbackReasons,
} from './reportSections';

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusClass(passed: boolean): string {
  return passed ? 'status-pass' : 'status-fail';
}

function renderProductCard(product: ScenarioProductDiagnostic): string {
  const cardClass = product.inRelevantProductIds ? 'product-card relevant' : 'product-card irrelevant';
  const badges: string[] = [];
  if (product.isMustInclude) badges.push('<span class="badge must-include">mustInclude</span>');
  if (product.violatesMustExclude) badges.push('<span class="badge must-exclude">mustExclude</span>');
  if (product.violatesCriticalMustExclude) {
    badges.push('<span class="badge critical">criticalMustExclude</span>');
  }

  return `<article class="${cardClass}">
  <header>
    <span class="rank">#${product.rank}</span>
    <h4>${escapeHtml(product.productName)}</h4>
    <span class="family">${escapeHtml(product.productFamily)}</span>
  </header>
  <p class="product-id">${escapeHtml(product.productId)}</p>
  <div class="badges">${badges.join('')}</div>
  <dl class="scores">
    <div><dt>Score</dt><dd>${product.deterministicScore.toFixed(3)}</dd></div>
    ${product.selectionScore != null ? `<div><dt>Selection</dt><dd>${product.selectionScore.toFixed(3)}</dd></div>` : ''}
    ${product.deterministicPosition != null ? `<div><dt>Det. pos</dt><dd>${product.deterministicPosition}</dd></div>` : ''}
    ${product.rerankPosition != null ? `<div><dt>Rerank pos</dt><dd>${product.rerankPosition}</dd></div>` : ''}
    ${product.finalPosition != null ? `<div><dt>Final pos</dt><dd>${product.finalPosition}</dd></div>` : ''}
    ${product.rankDelta != null ? `<div><dt>Rank delta</dt><dd>${product.rankDelta}</dd></div>` : ''}
    <div><dt>Matched</dt><dd>${escapeHtml(product.matchedAreas.join(', '))}</dd></div>
    <div><dt>Retail overlap</dt><dd>${escapeHtml(product.overlapRetailNeeds.join(', ') || 'none')}</dd></div>
  </dl>
  <details>
    <summary>Technical details</summary>
    <p>Reason codes: ${escapeHtml(product.positiveReasonCodes.join(', ') || 'none')}</p>
    <p>Relevant: ${product.inRelevantProductIds ? 'yes' : 'no'}</p>
  </details>
</article>`;
}

function renderScenarioSection(scenario: ScenarioDiagnostic): string {
  const failedPairAssertions = scenario.pairAssertionResults.filter((r) => !r.passed);
  const pairHtml =
    failedPairAssertions.length === 0
      ? '<p class="muted">All pair assertions passed.</p>'
      : `<ul class="pair-failures">${failedPairAssertions
          .map(
            (r) =>
              `<li><strong>${escapeHtml(r.productName)}</strong>: expected ${escapeHtml(r.expected)}, actual ${r.actualEligible ? 'ELIGIBLE' : escapeHtml(r.actualRejectionCode ?? 'REJECTED')}</li>`,
          )
          .join('')}</ul>`;

  const failureHtml =
    scenario.failureReasons.length === 0
      ? ''
      : `<div class="failure-reasons"><h4>Failure reasons</h4><ul>${scenario.failureReasons
          .map((r) => `<li>${escapeHtml(r)}</li>`)
          .join('')}</ul></div>`;

  const emptyRailHtml = scenario.emptyRailMessage
    ? `<p class="empty-rail">${escapeHtml(scenario.emptyRailMessage)}</p>`
    : '';

  return `<section class="scenario ${scenario.pass ? 'pass' : 'fail'}">
  <header>
    <h3>${escapeHtml(scenario.scenarioId)}</h3>
    <span class="scenario-status ${statusClass(scenario.pass)}">${scenario.pass ? 'PASS' : 'FAIL'}</span>
    ${scenario.expectEmpty ? '<span class="badge expect-empty">expected-empty</span>' : ''}
    <p class="service">${escapeHtml(scenario.serviceName)} <span class="muted">(${escapeHtml(scenario.serviceId)})</span></p>
    ${scenario.serviceDescription ? `<p class="description">${escapeHtml(scenario.serviceDescription)}</p>` : ''}
    <p class="precision">precision@4: ${(scenario.precisionAt4 * 100).toFixed(1)}%</p>
  </header>
  ${emptyRailHtml}
  ${failureHtml}
  <div class="product-grid">${scenario.selectedProducts.map(renderProductCard).join('')}</div>
  <div class="pair-assertions">
    <h4>Pair assertions</h4>
    ${pairHtml}
  </div>
</section>`;
}

function collectIrrelevantProducts(report: CalibrationReport): Array<{ scenarioId: string; productName: string }> {
  const items: Array<{ scenarioId: string; productName: string }> = [];
  for (const scenario of report.scenarioDiagnostics) {
    for (const product of scenario.selectedProducts) {
      if (!product.inRelevantProductIds) {
        items.push({ scenarioId: scenario.scenarioId, productName: product.productName });
      }
    }
  }
  return items;
}

export function buildCalibrationReviewHtml(report: CalibrationReport): string {
  const irrelevant = collectIrrelevantProducts(report);
  const failingScenarios = report.scenarioDiagnostics.filter((s) => !s.pass);
  const expectedEmptyScenarios = report.scenarioDiagnostics.filter((s) => s.expectEmpty);
  const isLive = report.mode === 'live';
  const banner = isLive
    ? 'LIVE MODEL OUTPUT — FICTIONAL CALIBRATION DATASET — No customer data'
    : 'DRY-RUN / STUB DATA — Hand-authored fixture self-check, not OpenAI output';

  const reconciliation = report.operationAccountingReconciliation;
  const reconciliationStatus = reconciliation
    ? reconciliation.ok
      ? 'PASS'
      : `FAIL — ${reconciliation.errors.join('; ')}`
    : 'NOT_RUN';

  const observedCost =
    report.cost.observedUsdKnown && report.cost.observedUsd != null
      ? `$${report.cost.observedUsd.toFixed(4)}`
      : 'unknown';

  const gateRows = report.releaseGates
    .map((gate) => {
      const status = gate.notEvaluated ? 'NOT_EVALUATED' : gate.skipped ? 'SKIP' : gate.passed ? 'PASS' : 'FAIL';
      return `<tr><td>${escapeHtml(gate.label)}</td><td>${escapeHtml(gate.threshold)}</td><td>${escapeHtml(gate.actual)}</td><td>${status}</td></tr>`;
    })
    .join('');

  const summaryCards = `
<div class="cards">
  <div class="card ${statusClass(report.harnessSelfCheckStatus === 'PASSED')}">
    <h3>Harness self-check</h3>
    <p class="value">${escapeHtml(report.harnessSelfCheckStatus)}</p>
  </div>
  <div class="card ${statusClass(report.harnessFixtureMetrics.precisionAt4 >= 0.95)}">
    <h3>Fixture precision@4</h3>
    <p class="value">${(report.harnessFixtureMetrics.precisionAt4 * 100).toFixed(1)}%</p>
  </div>
  <div class="card">
    <h3>Live evaluation</h3>
    <p class="value">${escapeHtml(report.liveEvaluationStatus)}</p>
  </div>
  <div class="card">
    <h3>Final outcome</h3>
    <p class="value">${escapeHtml(report.finalOutcome ?? 'N/A')}</p>
  </div>
</div>`;

  const irrelevantList =
    irrelevant.length === 0
      ? '<p class="muted">No irrelevant selected products in top-4.</p>'
      : `<ul>${irrelevant
          .map((i) => `<li><strong>${escapeHtml(i.scenarioId)}</strong>: ${escapeHtml(i.productName)}</li>`)
          .join('')}</ul>`;

  const failingList =
    failingScenarios.length === 0
      ? '<p class="muted">No failing scenarios.</p>'
      : `<ul>${failingScenarios
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.scenarioId)}</strong>: ${escapeHtml(s.failureReasons.join('; '))}</li>`,
          )
          .join('')}</ul>`;

  const expectedEmptyList =
    expectedEmptyScenarios.length === 0
      ? '<p class="muted">No expected-empty scenarios in scope.</p>'
      : `<ul>${expectedEmptyScenarios
          .map((s) => {
            const message = s.emptyRailMessage ?? s.failureReasons.join('; ');
            return `<li><strong>${escapeHtml(s.scenarioId)}</strong> (${s.pass ? 'PASS' : 'FAIL'}): ${escapeHtml(message)}</li>`;
          })
          .join('')}</ul>`;

  const skipLines =
    report.skipReasonCounts && Object.keys(report.skipReasonCounts).length > 0
      ? `<ul>${Object.entries(report.skipReasonCounts)
          .map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong>: ${v}</li>`)
          .join('')}</ul>`
      : '<p class="muted">None</p>';

  const fixtureMetrics = report.harnessFixtureMetrics;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calibration Review — ${escapeHtml(report.runId)}</title>
<style>
  :root { font-family: system-ui, sans-serif; color: #1a1a1a; background: #f5f5f5; }
  body { margin: 0; padding: 1rem; max-width: 960px; margin-inline: auto; }
  .banner { background: #b45309; color: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-weight: 700; text-align: center; }
  h1 { font-size: 1.5rem; margin-top: 0; }
  h2 { font-size: 1.2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
  .card { background: #fff; border-radius: 8px; padding: 1rem; border: 2px solid #ddd; }
  .card.status-pass { border-color: #16a34a; }
  .card.status-fail { border-color: #dc2626; }
  .card .value { font-size: 1.25rem; font-weight: 700; margin: 0; }
  .scenario { background: #fff; border-radius: 8px; padding: 1rem; margin: 1rem 0; border-left: 4px solid #ddd; }
  .scenario.pass { border-left-color: #16a34a; }
  .scenario.fail { border-left-color: #dc2626; }
  .scenario-status { font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
  .status-pass { background: #dcfce7; color: #166534; }
  .status-fail { background: #fee2e2; color: #991b1b; }
  .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
  .product-card { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem; }
  .product-card.relevant { border-color: #16a34a; background: #f0fdf4; }
  .product-card.irrelevant { border-color: #dc2626; background: #fef2f2; }
  .badge { display: inline-block; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; margin-right: 0.25rem; }
  .badge.must-include { background: #dbeafe; color: #1e40af; }
  .badge.must-exclude { background: #fef3c7; color: #92400e; }
  .badge.critical { background: #fee2e2; color: #991b1b; }
  .muted { color: #666; font-size: 0.9rem; }
  .failure-reasons { background: #fef2f2; padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; }
  dl.scores { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 1rem; font-size: 0.85rem; margin: 0.5rem 0; }
  dl.scores dt { font-weight: 600; }
  dl.scores dd { margin: 0; }
  details { font-size: 0.85rem; margin-top: 0.5rem; }
  ul { margin: 0.5rem 0; padding-left: 1.25rem; }
  @media (max-width: 600px) { .cards { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<div class="banner">${escapeHtml(banner)}</div>
<h1>Smart Retail Calibration Review</h1>
<p class="muted">Run ${escapeHtml(report.runId)} · ${escapeHtml(report.timestampUtc)} · Mode: ${escapeHtml(report.mode)} · Model: ${escapeHtml(report.modelId)} · Dataset: ${escapeHtml(report.datasetVersion)}</p>
<p class="muted">Taxonomy ${escapeHtml(report.taxonomyVersion)} · Schema ${escapeHtml(report.schemaVersion)} · Prompt ${escapeHtml(report.promptVersion)}</p>
${summaryCards}
<h2>Operation accounting</h2>
<p>Reconciliation: <strong>${escapeHtml(reconciliationStatus)}</strong></p>
<pre>${escapeHtml(formatOperationBreakdown(report))}</pre>
<h2>Calls &amp; cost</h2>
<ul>
  <li>Planned max calls: ${report.calls.plannedMax}</li>
  <li>Attempted: ${report.calls.attempted}</li>
  <li>Successful: ${report.calls.successful}</li>
  <li>Failed: ${report.calls.failed}</li>
  <li>Cache hits: ${report.calls.cacheHits}</li>
  <li>Skipped: ${report.calls.skipped}</li>
  <li>Rerank attempted/applied/fallback: ${report.calls.rerankAttempted}/${report.calls.rerankApplied}/${report.calls.rerankFallback}</li>
  <li>Prompt/completion/total tokens (known): ${report.tokens.prompt}/${report.tokens.completion}/${report.tokens.total}</li>
  <li>Known-usage calls: ${report.tokens.knownCallCount ?? 0}</li>
  <li>Unknown-usage calls: ${report.tokens.unknownCallCount ?? 0}</li>
  <li>Reserved max cost: $${report.cost.reservedMaxUsd.toFixed(4)}</li>
  <li>Observed cost: ${observedCost}</li>
  <li>Taxonomy: ${escapeHtml(report.taxonomyVersion)} · Schema: ${escapeHtml(report.schemaVersion)} · Prompt: ${escapeHtml(report.promptVersion)}</li>
</ul>
<h2>Error code counts</h2>
<pre>${escapeHtml(formatErrorCodeCounts(report))}</pre>
<h2>Skip reason counts</h2>
${skipLines}
<h2>Classification metrics (live)</h2>
<pre>${escapeHtml(formatClassificationMetricsBlock(report))}</pre>
<h2>Recommendation metrics (live)</h2>
<pre>${escapeHtml(formatRecommendationMetricsBlock(report))}</pre>
<h2>Rerank fallback reasons</h2>
<pre>${escapeHtml(formatRerankFallbackReasons(report))}</pre>
<h2>Fixture metrics (stub harness)</h2>
<ul>
  <li>precision@4: ${(fixtureMetrics.precisionAt4 * 100).toFixed(1)}%</li>
  <li>mustInclude recall: ${(fixtureMetrics.mustIncludeRecall * 100).toFixed(1)}%</li>
  <li>mustExclude pass: ${(fixtureMetrics.mustExcludePassRate * 100).toFixed(1)}%</li>
  <li>pair assertion pass: ${(fixtureMetrics.pairAssertionPassRate * 100).toFixed(1)}%</li>
  <li>deterministic repeatability: ${(fixtureMetrics.deterministicRepeatability * 100).toFixed(1)}%</li>
</ul>
<h2>Irrelevant selected products</h2>
${irrelevantList}
<h2>Failing scenarios</h2>
${failingList}
<h2>Expected-empty scenarios</h2>
${expectedEmptyList}
<h2>Release gates</h2>
<table>
<thead><tr><th>Gate</th><th>Threshold</th><th>Actual</th><th>Status</th></tr></thead>
<tbody>${gateRows}</tbody>
</table>
<h2>Scenario details</h2>
${report.scenarioDiagnostics.map(renderScenarioSection).join('')}
</body>
</html>`;
}
