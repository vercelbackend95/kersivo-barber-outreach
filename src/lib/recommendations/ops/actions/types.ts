export const OPS_RECOMMENDATION_ACTIONS = [
  'REBUILD',
  'RETRY_FAILED',
  'PAUSE_RAIL',
  'RESUME_RAIL',
] as const;

export type OpsRecommendationAction = (typeof OPS_RECOMMENDATION_ACTIONS)[number];

export const OPS_RECOMMENDATION_OUTCOMES = [
  'QUEUED',
  'APPLIED',
  'REJECTED',
  'CONFLICT',
  'FAILED',
] as const;

export type OpsRecommendationOutcome = (typeof OPS_RECOMMENDATION_OUTCOMES)[number];

export const OPS_ACTION_REASON_MAX_LENGTH = 500;

export const OPS_REBUILD_COOLDOWN_MS = 5 * 60 * 1000;

export const OPS_ACTION_ERROR_CODES = [
  'METHOD_NOT_ALLOWED',
  'WRONG_CONTENT_TYPE',
  'MISSING_ORIGIN',
  'MALFORMED_ORIGIN',
  'CROSS_ORIGIN',
  'INVALID_BODY',
  'INVALID_QUERY',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'EMAIL_NOT_VERIFIED',
  'OPS_ACCESS_NOT_CONFIGURED',
  'NOT_FOUND',
  'INELIGIBLE',
  'INSUFFICIENT_CATALOGUE',
  'CONFLICT',
  'ALREADY_PAUSED',
  'ALREADY_ACTIVE',
  'COOLDOWN',
  'IDEMPOTENCY_KEY_REUSED',
  'INTERNAL_ERROR',
] as const;

export type OpsActionErrorCode = (typeof OPS_ACTION_ERROR_CODES)[number];

export type OpsActionOperator = {
  userId: string;
  email: string;
};

export type OpsActionRequest = {
  action: OpsRecommendationAction;
  idempotencyKey: string;
  reason?: string;
};

export type OpsActionStateSnapshot = {
  jobStatus?: string | null;
  catalogueVersion?: number | null;
  pendingCatalogueVersion?: number | null;
  rebuildAfter?: string | null;
  attemptCount?: number | null;
  hasLiveProcessingLock?: boolean;
  railPaused?: boolean;
  railPausedAt?: string | null;
};

export type OpsActionResult = {
  ok: true;
  httpStatus: 200 | 202;
  data: {
    actionId: string;
    action: OpsRecommendationAction;
    outcome: OpsRecommendationOutcome;
    replayed: boolean;
    queued: boolean;
    state: OpsActionStateSnapshot;
  };
} | {
  ok: false;
  httpStatus: 400 | 404 | 409 | 429 | 500;
  error: {
    code: OpsActionErrorCode;
    retryAfterSeconds?: number;
  };
  /** Present when an authorized rejection/failure was audited. */
  actionId?: string;
};
