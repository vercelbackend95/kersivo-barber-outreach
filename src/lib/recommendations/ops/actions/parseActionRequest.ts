import {
  OPS_ACTION_REASON_MAX_LENGTH,
  OPS_RECOMMENDATION_ACTIONS,
  type OpsActionRequest,
  type OpsRecommendationAction,
} from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_KEYS = new Set(['action', 'idempotencyKey', 'reason']);

function isOpsAction(value: unknown): value is OpsRecommendationAction {
  return (
    typeof value === 'string' &&
    (OPS_RECOMMENDATION_ACTIONS as readonly string[]).includes(value)
  );
}

export type ParseActionRequestResult =
  | { ok: true; value: OpsActionRequest }
  | { ok: false; code: 'INVALID_BODY' };

/**
 * Strict body parser: exact supported action, UUID idempotency key,
 * bounded reason; rejects unknown fields.
 */
export function parseOpsActionRequest(raw: unknown): ParseActionRequestResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'INVALID_BODY' };
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, code: 'INVALID_BODY' };
    }
  }

  if (!isOpsAction(body.action)) {
    return { ok: false, code: 'INVALID_BODY' };
  }

  if (typeof body.idempotencyKey !== 'string' || !UUID_RE.test(body.idempotencyKey.trim())) {
    return { ok: false, code: 'INVALID_BODY' };
  }

  const action = body.action;
  const idempotencyKey = body.idempotencyKey.trim().toLowerCase();

  let reason: string | undefined;
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== 'string') {
      return { ok: false, code: 'INVALID_BODY' };
    }
    const trimmed = body.reason.trim();
    if (trimmed.length > OPS_ACTION_REASON_MAX_LENGTH) {
      return { ok: false, code: 'INVALID_BODY' };
    }
    reason = trimmed.length > 0 ? trimmed : undefined;
  }

  if ((action === 'PAUSE_RAIL' || action === 'RESUME_RAIL') && !reason) {
    return { ok: false, code: 'INVALID_BODY' };
  }

  return {
    ok: true,
    value: {
      action,
      idempotencyKey,
      ...(reason ? { reason } : {}),
    },
  };
}
