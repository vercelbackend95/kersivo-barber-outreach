import type { RecommendationJobStatus, RecommendationSetStatus } from '@prisma/client';

import type { RetailGateReason } from '@/lib/shop/cardPaymentsGate';
import type { RecommendationSetStats } from '@/lib/recommendations/contracts';

export type RecommendationHealthSeverity = 'OK' | 'INFO' | 'WARNING' | 'CRITICAL';

export type RecommendationHealthCode =
  | 'NOT_RETAIL_ELIGIBLE'
  | 'INSUFFICIENT_CATALOGUE'
  | 'STATE_MISSING'
  | 'PENDING'
  | 'PENDING_OVERDUE'
  | 'PROCESSING'
  | 'PROCESSING_LOCK_EXPIRED'
  | 'FAILED_RETRYING'
  | 'FAILED_EXHAUSTED'
  | 'STALE'
  | 'PUBLISHED_SET_MISSING'
  | 'PUBLISHED_SET_INVALID'
  | 'READY_NO_RAILS'
  | 'READY_PARTIAL'
  | 'HEALTHY';

/** Ops-only: PENDING past rebuildAfter by this margin is overdue. */
export const PENDING_OVERDUE_MS = 30 * 60 * 1000;

export const OVERVIEW_MAX_SEARCH_LENGTH = 100;
export const OVERVIEW_MAX_CURSOR_LENGTH = 512;
export const DETAIL_MAX_SHOP_ID_LENGTH = 128;

export type RecommendationHealthReasonCode =
  | RecommendationHealthCode
  | `retail_${RetailGateReason}`
  | 'catalogue_no_active_services'
  | 'catalogue_lt_two_active_products'
  | 'published_behind_catalogue'
  | 'taxonomy_mismatch'
  | 'schema_mismatch'
  | 'prompt_mismatch'
  | 'model_mismatch'
  | 'idle_with_pending_version'
  | 'published_version_mismatch'
  | 'published_pointer_absent'
  | 'published_set_wrong_shop'
  | 'published_set_not_ready'
  | 'published_set_missing_row'
  | 'no_service_rail'
  | 'partial_service_rails'
  | 'all_service_rails_ok'
  | 'lock_missing'
  | 'lock_expired'
  | 'retry_scheduled'
  | 'retry_overdue'
  | 'retry_exhausted'
  | 'pending_missing_rebuild_after';

export type RecommendationHealthFacts = {
  retailEligible: boolean;
  retailReason: RetailGateReason | null;
  activeServiceCount: number;
  activeProductCount: number;
  stateExists: boolean;
  jobStatus: RecommendationJobStatus | null;
  catalogueVersion: number | null;
  publishedCatalogueVersion: number | null;
  pendingCatalogueVersion: number | null;
  attemptCount: number | null;
  hasValidPublishedSet: boolean;
  servicesWithReadableRail: number;
  activeServicesConsidered: number;
};

export type RecommendationHealthResult = {
  code: RecommendationHealthCode;
  severity: RecommendationHealthSeverity;
  reasonCodes: RecommendationHealthReasonCode[];
  facts: RecommendationHealthFacts;
  generatedAt: string;
};

export type PublishedSetHealthView = {
  id: string;
  shopId: string;
  status: RecommendationSetStatus;
  catalogueVersion: number;
  taxonomyVersion: string;
  schemaVersion: string;
  promptVersion: string;
  modelId: string | null;
};

export type RecommendationStateHealthView = {
  catalogueVersion: number;
  publishedCatalogueVersion: number;
  publishedSetId: string | null;
  pendingCatalogueVersion: number | null;
  rebuildAfter: Date | null;
  jobStatus: RecommendationJobStatus;
  processingLockExpiresAt: Date | null;
  processingLockId: string | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  taxonomyVersion: string;
  updatedAt: Date | null;
};

export type DeriveRecommendationHealthInput = {
  retail: { ok: boolean; reason: RetailGateReason };
  activeServiceCount: number;
  activeProductCount: number;
  state: RecommendationStateHealthView | null;
  publishedSet: PublishedSetHealthView | null;
  servicesWithReadableRail: number;
  activeServicesConsidered: number;
  currentTaxonomyVersion: string;
  currentSchemaVersion: string;
  currentPromptVersion: string;
  currentModelId: string;
  maxJobAttempts: number;
  pendingOverdueMs?: number;
};

export type WhitelistedRecommendationSetStats = RecommendationSetStats;

export type RecommendationOpsShopOverview = {
  shop: {
    id: string;
    name: string;
    townCity: string | null;
    createdAt: string;
  };
  retail: {
    paid: boolean;
    retailEnabled: boolean;
    connectAccountPresent: boolean;
    connectChargesEnabled: boolean;
    eligible: boolean;
    reason: RetailGateReason;
  };
  catalogue: {
    activeServiceCount: number;
    activeProductCount: number;
  };
  state: {
    exists: boolean;
    catalogueVersion: number | null;
    publishedCatalogueVersion: number | null;
    pendingCatalogueVersion: number | null;
    rebuildAfter: string | null;
    jobStatus: RecommendationJobStatus | null;
    processingCatalogueVersion: number | null;
    processingLockExpiresAt: string | null;
    attemptCount: number | null;
    nextAttemptAt: string | null;
    lastErrorCode: string | null;
    lastErrorAt: string | null;
    taxonomyVersion: string | null;
    updatedAt: string | null;
  };
  publishedSet: {
    id: string;
    catalogueVersion: number;
    taxonomyVersion: string;
    schemaVersion: string;
    status: RecommendationSetStatus;
    modelId: string | null;
    rerankModelId: string | null;
    promptVersion: string;
    buildStartedAt: string;
    buildFinishedAt: string | null;
    errorCode: string | null;
  } | null;
  stats: WhitelistedRecommendationSetStats | null;
  coverage: {
    activeServices: number;
    servicesWithStoredItems: number;
    servicesWithReadableRail: number;
    totalStoredItems: number;
    totalReadableActiveItems: number;
  };
  health: RecommendationHealthResult;
};
