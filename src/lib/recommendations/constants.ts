/** Canonical taxonomy version for Smart Retail Recommendations V2. */
export const TAXONOMY_VERSION = '2026-09-v2';

export const SCHEMA_VERSION = '2';

export const PROMPT_VERSION = '2026-09-v4';

/** Debounce window after the last semantic catalogue change (ms). */
export const REBUILD_DEBOUNCE_MS = 120_000;

/** Processing lock TTL (ms). */
export const PROCESSING_LOCK_TTL_MS = 15 * 60 * 1000;

export const MAX_RECOMMENDATIONS = 4;

export const MIN_RECOMMENDATIONS_TO_RENDER = 2;

export const MAX_PER_PRODUCT_FAMILY = 2;

/** Minimum profile confidence to include entity in scoring. */
export const PROFILE_CONFIDENCE_MIN = 0.55;

/** Minimum confidence on critical semantic fields (targetAreas, retailNeeds). */
export const CRITICAL_FIELD_CONFIDENCE_MIN = 0.6;

/** Minimum semantic match score to include in set. */
export const MATCH_SCORE_MIN = 0.55;

/** Retail-need F1 threshold for GENERAL_GROOMING target-area neutral bridge. */
export const GENERAL_GROOMING_RETAIL_NEED_F1_MIN = 0.75;

/** Max eligible candidates passed to optional AI rerank per service. */
export const RERANK_CANDIDATE_LIMIT = 12;

/** Minimum model confidence required before bounded rerank adjustment is applied. */
export const RERANK_CONFIDENCE_MIN = 0.65;

/** Maximum absolute adjustment to selectionScore from AI rerank influence. */
export const RERANK_MAX_SCORE_ADJUSTMENT = 0.03;

export const MAX_JOB_ATTEMPTS = 6;

/** Max serviceId query params accepted by the public reader. */
export const MAX_SERVICE_IDS = 4;

export const JOB_BASE_BACKOFF_MS = 60_000;

export const JOB_MAX_BACKOFF_MS = 60 * 60 * 1000;
