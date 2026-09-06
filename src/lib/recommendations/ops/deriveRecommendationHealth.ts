import { RecommendationJobStatus, RecommendationSetStatus } from '@prisma/client';

import {
  MAX_JOB_ATTEMPTS,
  PROMPT_VERSION,
  SCHEMA_VERSION,
  TAXONOMY_VERSION,
} from '@/lib/recommendations/constants';
import { shouldRenderRecommendations } from '@/lib/recommendations/scorer';

import {
  PENDING_OVERDUE_MS,
  type DeriveRecommendationHealthInput,
  type RecommendationHealthCode,
  type RecommendationHealthFacts,
  type RecommendationHealthReasonCode,
  type RecommendationHealthResult,
  type RecommendationHealthSeverity,
} from './types';

function result(
  code: RecommendationHealthCode,
  severity: RecommendationHealthSeverity,
  reasonCodes: RecommendationHealthReasonCode[],
  facts: RecommendationHealthFacts,
  now: Date,
): RecommendationHealthResult {
  return {
    code,
    severity,
    reasonCodes: [...new Set(reasonCodes)],
    facts,
    generatedAt: now.toISOString(),
  };
}

function isValidReadyPublishedSet(input: DeriveRecommendationHealthInput, shopId?: string): boolean {
  if (!input.state?.publishedSetId || !input.publishedSet) return false;
  if (input.publishedSet.id !== input.state.publishedSetId) return false;
  if (input.publishedSet.status !== RecommendationSetStatus.READY) return false;
  if (shopId && input.publishedSet.shopId !== shopId) return false;
  return true;
}

function buildFacts(
  input: DeriveRecommendationHealthInput,
  shopId?: string,
): RecommendationHealthFacts {
  return {
    retailEligible: input.retail.ok,
    retailReason: input.retail.reason,
    activeServiceCount: input.activeServiceCount,
    activeProductCount: input.activeProductCount,
    stateExists: input.state != null,
    jobStatus: input.state?.jobStatus ?? null,
    catalogueVersion: input.state?.catalogueVersion ?? null,
    publishedCatalogueVersion: input.state?.publishedCatalogueVersion ?? null,
    pendingCatalogueVersion: input.state?.pendingCatalogueVersion ?? null,
    attemptCount: input.state?.attemptCount ?? null,
    hasValidPublishedSet: isValidReadyPublishedSet(input, shopId),
    servicesWithReadableRail: input.servicesWithReadableRail,
    activeServicesConsidered: input.activeServicesConsidered,
  };
}

function detectStaleReasons(
  input: DeriveRecommendationHealthInput,
): RecommendationHealthReasonCode[] {
  const reasons: RecommendationHealthReasonCode[] = [];
  const state = input.state;
  if (!state) return reasons;

  if (state.publishedCatalogueVersion < state.catalogueVersion) {
    reasons.push('published_behind_catalogue');
  }
  if (
    state.taxonomyVersion !== input.currentTaxonomyVersion ||
    (input.publishedSet != null &&
      input.publishedSet.taxonomyVersion !== input.currentTaxonomyVersion)
  ) {
    reasons.push('taxonomy_mismatch');
  }
  if (
    input.publishedSet != null &&
    input.publishedSet.schemaVersion !== input.currentSchemaVersion
  ) {
    reasons.push('schema_mismatch');
  }
  if (
    input.publishedSet != null &&
    input.publishedSet.promptVersion !== input.currentPromptVersion
  ) {
    reasons.push('prompt_mismatch');
  }
  if (
    input.publishedSet != null &&
    (input.publishedSet.modelId == null ||
      input.publishedSet.modelId !== input.currentModelId)
  ) {
    reasons.push('model_mismatch');
  }
  if (state.jobStatus === RecommendationJobStatus.IDLE && state.pendingCatalogueVersion != null) {
    reasons.push('idle_with_pending_version');
  }
  if (
    input.publishedSet &&
    state.publishedSetId === input.publishedSet.id &&
    input.publishedSet.catalogueVersion !== state.publishedCatalogueVersion
  ) {
    reasons.push('published_version_mismatch');
  }
  return reasons;
}

/**
 * Deterministic recommendation-ops health for a known shopId.
 * Pure; pass `now` explicitly. Enforces publishedSet.shopId === shopId.
 */
export function deriveRecommendationHealthForShop(
  shopId: string,
  input: DeriveRecommendationHealthInput,
  now: Date,
): RecommendationHealthResult {
  const normalized: DeriveRecommendationHealthInput = {
    ...input,
    currentTaxonomyVersion: input.currentTaxonomyVersion || TAXONOMY_VERSION,
    currentSchemaVersion: input.currentSchemaVersion || SCHEMA_VERSION,
    currentPromptVersion: input.currentPromptVersion || PROMPT_VERSION,
    currentModelId: input.currentModelId,
  };
  const facts = buildFacts(normalized, shopId);
  const overdueMs = normalized.pendingOverdueMs ?? PENDING_OVERDUE_MS;
  const maxAttempts = normalized.maxJobAttempts ?? MAX_JOB_ATTEMPTS;

  if (!normalized.retail.ok) {
    return result(
      'NOT_RETAIL_ELIGIBLE',
      'INFO',
      ['NOT_RETAIL_ELIGIBLE', `retail_${normalized.retail.reason}`],
      facts,
      now,
    );
  }

  if (normalized.activeServiceCount < 1) {
    return result(
      'INSUFFICIENT_CATALOGUE',
      'INFO',
      ['INSUFFICIENT_CATALOGUE', 'catalogue_no_active_services'],
      facts,
      now,
    );
  }
  if (normalized.activeProductCount < 2) {
    return result(
      'INSUFFICIENT_CATALOGUE',
      'INFO',
      ['INSUFFICIENT_CATALOGUE', 'catalogue_lt_two_active_products'],
      facts,
      now,
    );
  }

  if (!normalized.state) {
    return result('STATE_MISSING', 'WARNING', ['STATE_MISSING'], facts, now);
  }

  const state = normalized.state;

  if (state.jobStatus === RecommendationJobStatus.PENDING) {
    if (state.rebuildAfter == null) {
      return result(
        'PENDING_OVERDUE',
        'WARNING',
        ['PENDING_OVERDUE', 'pending_missing_rebuild_after'],
        facts,
        now,
      );
    }
    const overdue = now.getTime() - state.rebuildAfter.getTime() >= overdueMs;
    if (overdue) {
      return result('PENDING_OVERDUE', 'WARNING', ['PENDING_OVERDUE'], facts, now);
    }
    return result('PENDING', 'INFO', ['PENDING'], facts, now);
  }

  if (state.jobStatus === RecommendationJobStatus.PROCESSING) {
    const lockExpires = state.processingLockExpiresAt;
    const lockId = state.processingLockId;
    if (!lockId || !lockExpires || lockExpires.getTime() <= now.getTime()) {
      return result(
        'PROCESSING_LOCK_EXPIRED',
        'CRITICAL',
        ['PROCESSING_LOCK_EXPIRED', !lockId || !lockExpires ? 'lock_missing' : 'lock_expired'],
        facts,
        now,
      );
    }
    return result('PROCESSING', 'INFO', ['PROCESSING'], facts, now);
  }

  if (state.jobStatus === RecommendationJobStatus.FAILED) {
    const canRetry = state.nextAttemptAt != null && state.attemptCount < maxAttempts;
    if (canRetry && state.nextAttemptAt) {
      const retryOverdue = now.getTime() - state.nextAttemptAt.getTime() >= overdueMs;
      return result(
        'FAILED_RETRYING',
        'WARNING',
        ['FAILED_RETRYING', retryOverdue ? 'retry_overdue' : 'retry_scheduled'],
        facts,
        now,
      );
    }
    return result(
      'FAILED_EXHAUSTED',
      'CRITICAL',
      ['FAILED_EXHAUSTED', 'retry_exhausted'],
      facts,
      now,
    );
  }

  const staleReasons = detectStaleReasons(normalized);
  if (staleReasons.length > 0) {
    const valid = isValidReadyPublishedSet(normalized, shopId);
    return result(
      'STALE',
      valid ? 'WARNING' : 'CRITICAL',
      ['STALE', ...staleReasons],
      { ...facts, hasValidPublishedSet: valid },
      now,
    );
  }

  if (!state.publishedSetId) {
    return result(
      'PUBLISHED_SET_MISSING',
      'CRITICAL',
      ['PUBLISHED_SET_MISSING', 'published_pointer_absent'],
      facts,
      now,
    );
  }

  if (!normalized.publishedSet) {
    return result(
      'PUBLISHED_SET_INVALID',
      'CRITICAL',
      ['PUBLISHED_SET_INVALID', 'published_set_missing_row'],
      facts,
      now,
    );
  }

  if (normalized.publishedSet.shopId !== shopId) {
    return result(
      'PUBLISHED_SET_INVALID',
      'CRITICAL',
      ['PUBLISHED_SET_INVALID', 'published_set_wrong_shop'],
      { ...facts, hasValidPublishedSet: false },
      now,
    );
  }

  if (normalized.publishedSet.id !== state.publishedSetId) {
    return result(
      'PUBLISHED_SET_INVALID',
      'CRITICAL',
      ['PUBLISHED_SET_INVALID', 'published_set_missing_row'],
      facts,
      now,
    );
  }

  if (normalized.publishedSet.status !== RecommendationSetStatus.READY) {
    return result(
      'PUBLISHED_SET_INVALID',
      'CRITICAL',
      ['PUBLISHED_SET_INVALID', 'published_set_not_ready'],
      facts,
      now,
    );
  }

  const considered = normalized.activeServicesConsidered;
  const withRail = normalized.servicesWithReadableRail;

  if (considered <= 0 || withRail <= 0) {
    return result(
      'READY_NO_RAILS',
      'WARNING',
      ['READY_NO_RAILS', 'no_service_rail'],
      facts,
      now,
    );
  }

  if (withRail < considered) {
    return result(
      'READY_PARTIAL',
      'INFO',
      ['READY_PARTIAL', 'partial_service_rails'],
      facts,
      now,
    );
  }

  return result('HEALTHY', 'OK', ['HEALTHY', 'all_service_rails_ok'], facts, now);
}

export function deriveRecommendationHealth(
  input: DeriveRecommendationHealthInput & { shopId: string },
  now: Date,
): RecommendationHealthResult {
  return deriveRecommendationHealthForShop(input.shopId, input, now);
}

export function serviceRailWillRender(readableActiveCount: number): boolean {
  return shouldRenderRecommendations(readableActiveCount);
}
