export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { isHubRouteEnabled } from '@/lib/freePreview/hubPage';
import {
  applyHubContentReview,
  dismissHubContentReview,
  HubApplyIncompatibleError,
  loadHubReviewShopData,
  loadLatestHubReviews,
  reviewDiff,
} from '@/lib/freePreview/hubReviews';
import { HUB_OPS_APPLY_INCOMPATIBLE, HUB_OPS_DISMISS_NOTE_REQUIRED, HUB_OPS_NO_PROPOSAL } from '@/lib/freePreview/hubCopy';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

const mutateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('apply'), reviewId: z.string().trim().min(1).max(64) }),
  z.object({
    action: z.literal('dismiss'),
    reviewId: z.string().trim().min(1).max(64),
    opsNote: z.string().trim().min(1, HUB_OPS_DISMISS_NOTE_REQUIRED).max(2000),
  }),
]);

export const GET: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { id: true, anonymisedAt: true, draftShopId: true },
  });
  if (!request || request.anonymisedAt) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const reviews = await loadLatestHubReviews(request.id);
  const shop = request.draftShopId ? await loadHubReviewShopData(request.draftShopId, request.id) : null;
  const diffs = shop
    ? {
        SERVICES: reviews.SERVICES ? reviewDiff({ section: 'SERVICES', current: shop, proposal: reviews.SERVICES.proposal }) : [],
        TEAM: reviews.TEAM ? reviewDiff({ section: 'TEAM', current: shop, proposal: reviews.TEAM.proposal }) : [],
        HOURS: reviews.HOURS ? reviewDiff({ section: 'HOURS', current: shop, proposal: reviews.HOURS.proposal }) : [],
      }
    : { SERVICES: [], TEAM: [], HOURS: [] };
  return json({ ok: true, reviews, shop, diffs, sitePreviewUrl: null });
};

export const POST: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { id: true, anonymisedAt: true, draftShopId: true },
  });
  if (!request || request.anonymisedAt) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }
  const parsed = mutateSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);

  if (parsed.data.action === 'dismiss') {
    const result = await dismissHubContentReview({
      previewRequestId: request.id,
      reviewId: parsed.data.reviewId,
      opsNote: parsed.data.opsNote,
    });
    if (!result.ok) return json({ ok: false, error: { code: result.code } }, result.code === 'NOT_FOUND' ? 404 : 409);
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_REVIEW_DISMISSED,
        actorEmail: access.email,
        meta: { reviewId: result.review.id, section: result.review.section },
      },
    });
    return json({ ok: true, review: result.review });
  }

  if (!request.draftShopId) return json({ ok: false, error: { code: 'NO_DRAFT_SHOP' } }, 409);
  try {
    const result = await applyHubContentReview({
      previewRequestId: request.id,
      reviewId: parsed.data.reviewId,
      shopId: request.draftShopId,
      actorEmail: access.email,
    });
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      const message = result.code === 'INCOMPATIBLE' ? HUB_OPS_APPLY_INCOMPATIBLE : HUB_OPS_NO_PROPOSAL;
      return json({ ok: false, error: { code: result.code, message } }, status);
    }
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_REVIEW_APPLIED,
        actorEmail: access.email,
        meta: { reviewId: result.review.id, section: result.review.section },
      },
    });
    return json({ ok: true, review: result.review });
  } catch (error) {
    if (error instanceof HubApplyIncompatibleError) {
      return json({ ok: false, error: { code: 'INCOMPATIBLE', message: HUB_OPS_APPLY_INCOMPATIBLE } }, 409);
    }
    console.error('[ops/preview-requests] apply review failed', error instanceof Error ? error.message : error);
    return json({ ok: false, error: { code: 'APPLY_FAILED' } }, 500);
  }
};
