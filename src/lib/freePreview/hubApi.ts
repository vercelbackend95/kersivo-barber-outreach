import type { PreviewHubAssetKind } from '@prisma/client';
import { evaluateExactSameOrigin } from '@/lib/ops/requireOperatorMutation';
import { resolveOperatorAccess } from '@/lib/ops/operatorAuth';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { checkDurableRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit/durableRateLimit';
import { previewJson } from './previewApi';
import { readHubCookie, verifyHubSession } from '@/lib/adminHub/hubSession';
import {
  isAdminHubRouteEnabled,
  isHubRouteEnabled,
  resolveHubContext,
  resolveHubPageContext,
  tokenPrefixForLog,
  type HubPageContext,
} from './hubPage';
import { previewTokenLookupHash } from './token';
import { HUB_MAX_BODY_BYTES, HUB_OWNER_UPLOAD_KINDS } from './hubAssets';
import { HUB_ROUND_USED, HUB_UPLOAD_ERROR_DENIED, HUB_UPLOAD_ERROR_TOO_LARGE_BODY } from './hubCopy';

export const PREVIEW_HUB_ASSETS_IP_RATE = {
  action: 'preview_hub_assets_ip',
  limit: 40,
  windowMs: 15 * 60 * 1000,
};
export const PREVIEW_HUB_ASSETS_TOKEN_RATE = {
  action: 'preview_hub_assets_token',
  limit: 60,
  windowMs: 15 * 60 * 1000,
};
export const PREVIEW_HUB_DETAILS_IP_RATE = {
  action: 'preview_hub_details_ip',
  limit: 40,
  windowMs: 15 * 60 * 1000,
};
export const PREVIEW_HUB_ASSET_GET_RATE = {
  action: 'preview_hub_asset_get',
  limit: 240,
  windowMs: 60 * 60 * 1000,
};
export const PREVIEW_HUB_MESSAGES_IP_RATE = {
  action: 'preview_hub_messages_ip',
  limit: 20,
  windowMs: 60 * 60 * 1000,
};
export const PREVIEW_HUB_MESSAGES_REQUEST_HOUR_RATE = {
  action: 'preview_hub_messages_request_hour',
  limit: 20,
  windowMs: 60 * 60 * 1000,
};
export const PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE = {
  action: 'preview_hub_messages_request_day',
  limit: 100,
  windowMs: 24 * 60 * 60 * 1000,
};
export const PREVIEW_HUB_REVIEWS_IP_RATE = {
  action: 'preview_hub_reviews_ip',
  limit: 40,
  windowMs: 15 * 60 * 1000,
};
export const PREVIEW_HUB_CHANGES_IP_RATE = {
  action: 'preview_hub_changes_ip',
  limit: 40,
  windowMs: 15 * 60 * 1000,
};

export const HUB_API_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
} as const;

export function hubJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HUB_API_HEADERS });
}

/** Adds the private hub headers to a response built elsewhere (e.g. the shared checkout). */
export function withHubApiHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(HUB_API_HEADERS)) {
    if (name !== 'Content-Type') headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function hubNotFoundJson(): Response {
  return hubJson({ ok: false, error: 'Not found.' }, 404);
}

export function rejectOversizedHubBody(request: Request): Response | null {
  const raw = request.headers.get('content-length');
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isFinite(length) || length <= HUB_MAX_BODY_BYTES) return null;
  return hubJson({ ok: false, error: HUB_UPLOAD_ERROR_TOO_LARGE_BODY }, 413);
}

/** Rejects oversized uploads even when Content-Length is missing (chunked / streamed). */
export async function readLimitedHubBody(
  request: Request,
): Promise<{ ok: true; request: Request } | { ok: false; response: Response }> {
  const headerReject = rejectOversizedHubBody(request);
  if (headerReject) return { ok: false, response: headerReject };
  if (!request.body) return { ok: true, request };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > HUB_MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, response: hubJson({ ok: false, error: HUB_UPLOAD_ERROR_TOO_LARGE_BODY }, 413) };
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks);
  const headers = new Headers(request.headers);
  headers.set('content-length', String(buffer.byteLength));
  return {
    ok: true,
    request: new Request(request.url, {
      method: request.method,
      headers,
      body: buffer,
    }),
  };
}

/**
 * Where a hub API call gets its request from: the URL token (/api/preview-hub/{token}/*) or the signed `ks_hub`
 * cookie (/api/admin-hub/*, docs/admin-hub/ADMIN_HUB_SPEC.md §2.2). Both run the same handlers.
 */
export type HubApiSource = { kind: 'token'; token: string } | { kind: 'cookie' };
export type HubSourceOf = (params: Record<string, string | undefined>) => HubApiSource;

export const tokenSourceOf: HubSourceOf = (params) => ({ kind: 'token', token: params.token ?? '' });
export const cookieSourceOf: HubSourceOf = () => ({ kind: 'cookie' });

/** Per-request rate-limit key: the token as before, or the HMAC-verified request id from `ks_hub`. */
export function hubRateKey(source: HubApiSource, request: Request): string {
  if (source.kind === 'token') return source.token;
  const session = verifyHubSession(readHubCookie(request));
  return session ? `ks_hub:${session.previewRequestId}` : '';
}

/** Safe log reference: never the whole token, never the cookie. */
export function hubLogRef(source: HubApiSource): string {
  return source.kind === 'token' ? tokenPrefixForLog(source.token) : 'ks_hub';
}

export async function resolveHubApiContext(input: {
  request: Request;
  token?: string;
  source?: HubApiSource;
  mutation: boolean;
}): Promise<{ ok: true; ctx: HubPageContext } | { ok: false; response: Response }> {
  const source: HubApiSource = input.source ?? { kind: 'token', token: input.token ?? '' };
  const enabled = source.kind === 'cookie' ? isAdminHubRouteEnabled() : isHubRouteEnabled();
  if (!enabled) return { ok: false, response: hubNotFoundJson() };

  if (input.mutation) {
    const origin = evaluateExactSameOrigin(input.request);
    if (!origin.ok) return { ok: false, response: hubJson({ ok: false, error: 'Forbidden.' }, 403) };
  }

  const operator = await resolveOperatorAccess(input.request);
  const now = new Date();
  if (source.kind === 'cookie') {
    const ctx = await resolveHubContext({ cookie: readHubCookie(input.request) }, { isOperator: operator.ok, now });
    if (!ctx) {
      console.info('[admin-hub] cookie miss');
      return { ok: false, response: hubNotFoundJson() };
    }
    return { ok: true, ctx };
  }

  const token = source.token.trim();
  const ctx = await resolveHubPageContext({
    token,
    isOperator: operator.ok,
    now,
  });
  if (!ctx) {
    console.info('[preview-hub] token miss', { token: tokenPrefixForLog(token) });
    return { ok: false, response: hubNotFoundJson() };
  }
  return { ok: true, ctx };
}

export async function enforceHubAssetRates(request: Request, token: string): Promise<Response | null> {
  const ipLimited = await enforceIpRateLimit(
    request,
    PREVIEW_HUB_ASSETS_IP_RATE.action,
    PREVIEW_HUB_ASSETS_IP_RATE.limit,
    PREVIEW_HUB_ASSETS_IP_RATE.windowMs,
  );
  if (ipLimited) return ipLimited;
  const tokenKey = previewTokenLookupHash(token.trim() || 'invalid');
  const tokenLimit = await checkDurableRateLimit({
    key: `hub:${tokenKey}`,
    action: PREVIEW_HUB_ASSETS_TOKEN_RATE.action,
    limit: PREVIEW_HUB_ASSETS_TOKEN_RATE.limit,
    windowMs: PREVIEW_HUB_ASSETS_TOKEN_RATE.windowMs,
  });
  if (!tokenLimit.ok) return rateLimitExceededResponse(tokenLimit.retryAfterSeconds);
  return null;
}

export async function enforceHubDetailsRate(request: Request): Promise<Response | null> {
  return enforceIpRateLimit(
    request,
    PREVIEW_HUB_DETAILS_IP_RATE.action,
    PREVIEW_HUB_DETAILS_IP_RATE.limit,
    PREVIEW_HUB_DETAILS_IP_RATE.windowMs,
  );
}

export async function enforceHubAssetGetRate(request: Request): Promise<Response | null> {
  return enforceIpRateLimit(
    request,
    PREVIEW_HUB_ASSET_GET_RATE.action,
    PREVIEW_HUB_ASSET_GET_RATE.limit,
    PREVIEW_HUB_ASSET_GET_RATE.windowMs,
  );
}

export function requireUploadCapability(ctx: HubPageContext, kind?: PreviewHubAssetKind): Response | null {
  if (kind === 'MESSAGE_ATTACHMENT' && ctx.state.capabilities.canMessage) return null;
  if (kind === 'CHANGE_ATTACHMENT' && ctx.state.capabilities.canDraftChanges) return null;
  if (!ctx.state.capabilities.canUpload) {
    return hubJson({ ok: false, error: HUB_UPLOAD_ERROR_DENIED }, 403);
  }
  return null;
}

export function requireReviewCapability(ctx: HubPageContext): Response | null {
  if (!ctx.state.capabilities.canReview) {
    return hubJson({ ok: false, error: 'You cannot review details at this stage.' }, 403);
  }
  return null;
}

export function requireDraftChangesCapability(ctx: HubPageContext): Response | null {
  if (!ctx.state.capabilities.canDraftChanges) {
    return hubJson({ ok: false, error: 'You cannot suggest changes at this stage.' }, 403);
  }
  return null;
}

export function requireSendChangesCapability(ctx: HubPageContext): Response | null {
  if (!ctx.state.capabilities.canSendChanges) {
    return hubJson({ ok: false, error: HUB_ROUND_USED }, 403);
  }
  return null;
}

export function requireMessageCapability(ctx: HubPageContext): Response | null {
  if (!ctx.state.capabilities.canMessage) {
    return hubJson({ ok: false, error: 'You cannot send messages at this stage.' }, 403);
  }
  return null;
}

export async function enforceHubMessageRates(request: Request, token: string): Promise<Response | null> {
  const ipLimited = await enforceIpRateLimit(
    request,
    PREVIEW_HUB_MESSAGES_IP_RATE.action,
    PREVIEW_HUB_MESSAGES_IP_RATE.limit,
    PREVIEW_HUB_MESSAGES_IP_RATE.windowMs,
  );
  if (ipLimited) return ipLimited;
  const tokenKey = previewTokenLookupHash(token.trim() || 'invalid');
  const hourLimit = await checkDurableRateLimit({
    key: `hub-msg-h:${tokenKey}`,
    action: PREVIEW_HUB_MESSAGES_REQUEST_HOUR_RATE.action,
    limit: PREVIEW_HUB_MESSAGES_REQUEST_HOUR_RATE.limit,
    windowMs: PREVIEW_HUB_MESSAGES_REQUEST_HOUR_RATE.windowMs,
  });
  if (!hourLimit.ok) return rateLimitExceededResponse(hourLimit.retryAfterSeconds);
  const dayLimit = await checkDurableRateLimit({
    key: `hub-msg-d:${tokenKey}`,
    action: PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE.action,
    limit: PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE.limit,
    windowMs: PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE.windowMs,
  });
  if (!dayLimit.ok) return rateLimitExceededResponse(dayLimit.retryAfterSeconds);
  return null;
}

export async function enforceHubReviewsRate(request: Request): Promise<Response | null> {
  return enforceIpRateLimit(
    request,
    PREVIEW_HUB_REVIEWS_IP_RATE.action,
    PREVIEW_HUB_REVIEWS_IP_RATE.limit,
    PREVIEW_HUB_REVIEWS_IP_RATE.windowMs,
  );
}

export async function enforceHubChangesRate(request: Request): Promise<Response | null> {
  return enforceIpRateLimit(
    request,
    PREVIEW_HUB_CHANGES_IP_RATE.action,
    PREVIEW_HUB_CHANGES_IP_RATE.limit,
    PREVIEW_HUB_CHANGES_IP_RATE.windowMs,
  );
}

export function requireEditDetailsCapability(ctx: HubPageContext): Response | null {
  if (!ctx.state.capabilities.canEditDetails) {
    return hubJson({ ok: false, error: HUB_UPLOAD_ERROR_DENIED }, 403);
  }
  return null;
}

export function parseHubAssetKind(value: unknown): PreviewHubAssetKind | null {
  if (typeof value !== 'string') return null;
  return (HUB_OWNER_UPLOAD_KINDS as readonly string[]).includes(value)
    ? (value as PreviewHubAssetKind)
    : null;
}

export { previewJson };
