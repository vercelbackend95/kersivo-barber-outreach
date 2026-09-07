/**
 * Small explicit runtime guards for Smart Retail ops API payloads.
 * Fail closed — no validation framework.
 */

import {
  OPS_ACTION_ERROR_CODES,
  OPS_RECOMMENDATION_ACTIONS,
  OPS_RECOMMENDATION_OUTCOMES,
  type OpsActionErrorCode,
  type OpsRecommendationAction,
  type OpsRecommendationOutcome,
} from './actions/types';

export function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegInt(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

export function isIsoTimestampOrNull(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isNonNegIntOrNull(value: unknown): value is number | null {
  return value === null || isNonNegInt(value);
}

export function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

const ACTION_SET = new Set<string>(OPS_RECOMMENDATION_ACTIONS);
const OUTCOME_SET = new Set<string>(OPS_RECOMMENDATION_OUTCOMES);
const ERROR_CODE_SET = new Set<string>(OPS_ACTION_ERROR_CODES);

export function isOpsRecommendationAction(value: unknown): value is OpsRecommendationAction {
  return typeof value === 'string' && ACTION_SET.has(value);
}

export function isOpsRecommendationOutcome(value: unknown): value is OpsRecommendationOutcome {
  return typeof value === 'string' && OUTCOME_SET.has(value);
}

export function isOpsActionErrorCodeOrNull(value: unknown): value is OpsActionErrorCode | null {
  return value === null || (typeof value === 'string' && ERROR_CODE_SET.has(value));
}

export function isOpsControlPayload(value: unknown): value is {
  railPaused: boolean;
  railPausedAt: string | null;
  railPausedByUserId: string | null;
  railPauseReason: string | null;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return (
    isBoolean(c.railPaused) &&
    isStringOrNull(c.railPausedAt) &&
    isStringOrNull(c.railPausedByUserId) &&
    isStringOrNull(c.railPauseReason)
  );
}

export function isOpsRecentActionPayload(value: unknown): value is {
  id: string;
  action: OpsRecommendationAction;
  outcome: OpsRecommendationOutcome;
  actorEmail: string;
  reason: string | null;
  errorCode: OpsActionErrorCode | null;
  createdAt: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    isOpsRecommendationAction(a.action) &&
    isOpsRecommendationOutcome(a.outcome) &&
    typeof a.actorEmail === 'string' &&
    isIsoTimestamp(a.createdAt) &&
    isStringOrNull(a.reason) &&
    isOpsActionErrorCodeOrNull(a.errorCode)
  );
}

export function isOpsRecentActionsArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isOpsRecentActionPayload);
}

function isOpsShopIdentity(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    isStringOrNull(s.townCity) &&
    isIsoTimestamp(s.createdAt)
  );
}

function isOpsRetailSlice(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return (
    isBoolean(r.paid) &&
    isBoolean(r.retailEnabled) &&
    isBoolean(r.connectAccountPresent) &&
    isBoolean(r.connectChargesEnabled) &&
    isBoolean(r.eligible) &&
    typeof r.reason === 'string'
  );
}

function isOpsCatalogueSlice(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return isNonNegInt(c.activeServiceCount) && isNonNegInt(c.activeProductCount);
}

function isOpsStateSlice(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    isBoolean(s.exists) &&
    isNonNegIntOrNull(s.catalogueVersion) &&
    isNonNegIntOrNull(s.publishedCatalogueVersion) &&
    isNonNegIntOrNull(s.pendingCatalogueVersion) &&
    isIsoTimestampOrNull(s.rebuildAfter) &&
    isStringOrNull(s.jobStatus) &&
    isNonNegIntOrNull(s.processingCatalogueVersion) &&
    isIsoTimestampOrNull(s.processingLockExpiresAt) &&
    isNonNegIntOrNull(s.attemptCount) &&
    isIsoTimestampOrNull(s.nextAttemptAt) &&
    isStringOrNull(s.lastErrorCode) &&
    isIsoTimestampOrNull(s.lastErrorAt) &&
    isStringOrNull(s.taxonomyVersion) &&
    isIsoTimestampOrNull(s.updatedAt)
  );
}

function isOpsPublishedSet(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    isNonNegInt(p.catalogueVersion) &&
    typeof p.taxonomyVersion === 'string' &&
    typeof p.schemaVersion === 'string' &&
    typeof p.status === 'string' &&
    isStringOrNull(p.modelId) &&
    isStringOrNull(p.rerankModelId) &&
    typeof p.promptVersion === 'string' &&
    isIsoTimestamp(p.buildStartedAt) &&
    isIsoTimestampOrNull(p.buildFinishedAt) &&
    isStringOrNull(p.errorCode)
  );
}

const STATS_NUMBER_KEYS = [
  'serviceCount',
  'productCount',
  'itemCount',
  'rerankEligibleServiceCount',
  'rerankAttemptedServiceCount',
  'rerankAppliedServiceCount',
  'rerankFallbackServiceCount',
  'rerankSkippedInsufficientCandidatesCount',
] as const;

export function isOpsStatsPayload(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  for (const key of STATS_NUMBER_KEYS) {
    if (!isNonNegInt(s[key])) return false;
  }
  if (
    !s.rerankFallbackReasonCounts ||
    typeof s.rerankFallbackReasonCounts !== 'object' ||
    Array.isArray(s.rerankFallbackReasonCounts)
  ) {
    return false;
  }
  for (const [k, v] of Object.entries(
    s.rerankFallbackReasonCounts as Record<string, unknown>,
  )) {
    if (typeof k !== 'string' || !isNonNegInt(v)) return false;
  }
  return true;
}

function isOpsCoverageSlice(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return (
    isNonNegInt(c.activeServices) &&
    isNonNegInt(c.servicesWithStoredItems) &&
    isNonNegInt(c.servicesWithReadableRail) &&
    isNonNegInt(c.totalStoredItems) &&
    isNonNegInt(c.totalReadableActiveItems)
  );
}

function isOpsHealthSlice(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.code === 'string' &&
    typeof h.severity === 'string' &&
    isStringArray(h.reasonCodes) &&
    !!h.facts &&
    typeof h.facts === 'object' &&
    !Array.isArray(h.facts) &&
    isIsoTimestamp(h.generatedAt)
  );
}

export function isOpsOverviewShopPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const shop = value as Record<string, unknown>;
  return (
    isOpsShopIdentity(shop.shop) &&
    isOpsRetailSlice(shop.retail) &&
    isOpsCatalogueSlice(shop.catalogue) &&
    isOpsStateSlice(shop.state) &&
    isOpsPublishedSet(shop.publishedSet) &&
    isOpsStatsPayload(shop.stats) &&
    isOpsCoverageSlice(shop.coverage) &&
    isOpsControlPayload(shop.control) &&
    isOpsHealthSlice(shop.health)
  );
}

function isConfidenceGate(value: unknown): boolean {
  return value === null || isBoolean(value) || isFiniteNumber(value);
}

export function isOpsDetailRecommendationPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.productId === 'string' &&
    typeof r.productName === 'string' &&
    typeof r.productCategory === 'string' &&
    isBoolean(r.productActive) &&
    isNonNegInt(r.rank) &&
    isFiniteNumber(r.deterministicScore) &&
    isFiniteNumberOrNull(r.rerankPosition) &&
    isStringArray(r.reasonCodes) &&
    isConfidenceGate(r.confidenceGate) &&
    isBoolean(r.retainedByPublicReader)
  );
}

export function isOpsDetailServicePayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.category === 'string' &&
    isBoolean(s.profilePresent) &&
    isFiniteNumberOrNull(s.profileConfidence) &&
    isStringOrNull(s.taxonomyVersion) &&
    isStringOrNull(s.schemaVersion) &&
    isStringOrNull(s.promptVersion) &&
    isStringOrNull(s.modelId) &&
    isIsoTimestampOrNull(s.classifiedAt) &&
    isBoolean(s.profileMetadataCurrent) &&
    isNonNegInt(s.storedRecommendationCount) &&
    isNonNegInt(s.readableActiveRecommendationCount) &&
    isBoolean(s.railWillRender) &&
    Array.isArray(s.recommendations) &&
    s.recommendations.every(isOpsDetailRecommendationPayload)
  );
}

export function isOpsDetailProductPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.category === 'string' &&
    isBoolean(p.active) &&
    isBoolean(p.profilePresent) &&
    isFiniteNumberOrNull(p.profileConfidence) &&
    isStringOrNull(p.taxonomyVersion) &&
    isStringOrNull(p.schemaVersion) &&
    isStringOrNull(p.promptVersion) &&
    isStringOrNull(p.modelId) &&
    isIsoTimestampOrNull(p.classifiedAt) &&
    isBoolean(p.profileMetadataCurrent)
  );
}

export function isOpsDetailRecentSetPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    isNonNegInt(s.catalogueVersion) &&
    typeof s.taxonomyVersion === 'string' &&
    typeof s.schemaVersion === 'string' &&
    typeof s.status === 'string' &&
    isStringOrNull(s.modelId) &&
    isStringOrNull(s.rerankModelId) &&
    typeof s.promptVersion === 'string' &&
    isIsoTimestamp(s.buildStartedAt) &&
    isIsoTimestampOrNull(s.buildFinishedAt) &&
    isStringOrNull(s.errorCode) &&
    isOpsStatsPayload(s.stats)
  );
}

export function isOpsProfileSummaryPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    isNonNegInt(p.activeServicesTotal) &&
    isNonNegInt(p.activeServicesWithCurrentProfile) &&
    isNonNegInt(p.activeProductsTotal) &&
    isNonNegInt(p.activeProductsWithCurrentProfile)
  );
}

export function isOpsReturnedPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return isNonNegInt(r.services) && isNonNegInt(r.products);
}

export function isOpsTruncationPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const t = value as Record<string, unknown>;
  return isBoolean(t.services) && isBoolean(t.products);
}

export function isOpsShopDetailDataPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    isOpsOverviewShopPayload(data.overview) &&
    isOpsRecentActionsArray(data.recentActions) &&
    Array.isArray(data.recentSets) &&
    data.recentSets.every(isOpsDetailRecentSetPayload) &&
    Array.isArray(data.services) &&
    data.services.every(isOpsDetailServicePayload) &&
    Array.isArray(data.products) &&
    data.products.every(isOpsDetailProductPayload) &&
    isOpsProfileSummaryPayload(data.profileSummary) &&
    isOpsReturnedPayload(data.returned) &&
    isOpsTruncationPayload(data.truncation)
  );
}
