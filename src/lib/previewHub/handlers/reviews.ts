import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  enforceHubReviewsRate,
  hubJson,
  hubLogRef,
  requireReviewCapability,
  resolveHubApiContext,
  type HubSourceOf,
} from '@/lib/freePreview/hubApi';
import {
  assertTeamPhotoAsset,
  createHubContentReview,
  hubReviewPostSchema,
  loadHubReviewShopData,
  loadLatestHubReviews,
} from '@/lib/freePreview/hubReviews';

export function createHubReviewsHandlers(sourceOf: HubSourceOf): { GET: APIRoute; POST: APIRoute } {
  const GET: APIRoute = async ({ request, params }) => {
    const ctxResult = await resolveHubApiContext({ request, source: sourceOf(params), mutation: false });
    if (!ctxResult.ok) return ctxResult.response;
    const shopId = ctxResult.ctx.request.draftShopId;
    const [reviews, shop] = await Promise.all([
      loadLatestHubReviews(ctxResult.ctx.request.id),
      shopId ? loadHubReviewShopData(shopId, ctxResult.ctx.request.id) : Promise.resolve(null),
    ]);
    return hubJson({
      ok: true,
      reviews,
      shop,
      changeRoundsUsed: ctxResult.ctx.request.changeRoundsUsed,
      includedChangeRounds: ctxResult.ctx.request.includedChangeRounds,
    });
  };

  const POST: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubReviewsRate(request);
    if (limited) return limited;

    const ctxResult = await resolveHubApiContext({ request, source, mutation: true });
    if (!ctxResult.ok) return ctxResult.response;
    const denied = requireReviewCapability(ctxResult.ctx);
    if (denied) return denied;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
    }
    const parsed = hubReviewPostSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'Invalid request body.';
      return hubJson({ ok: false, error: first }, 400);
    }

    if (parsed.data.action === 'corrections' && parsed.data.section === 'TEAM') {
      for (const barber of parsed.data.proposal.barbers) {
        const photo = await assertTeamPhotoAsset({
          previewRequestId: ctxResult.ctx.request.id,
          assetId: barber.photoAssetId,
        });
        if (!photo.ok) return hubJson({ ok: false, error: photo.error }, 400);
      }
    }

    try {
      const usedBefore = ctxResult.ctx.request.changeRoundsUsed;
      const review = await createHubContentReview({
        previewRequestId: ctxResult.ctx.request.id,
        body: parsed.data,
      });
      const after = await prisma.previewRequest.findUnique({
        where: { id: ctxResult.ctx.request.id },
        select: { changeRoundsUsed: true },
      });
      if ((after?.changeRoundsUsed ?? usedBefore) !== usedBefore) {
        throw new Error('changeRoundsUsed changed during a data correction');
      }
      const action =
        parsed.data.action === 'confirmed'
          ? PREVIEW_REQUEST_ACTIONS.HUB_REVIEW_CONFIRMED
          : PREVIEW_REQUEST_ACTIONS.HUB_REVIEW_CORRECTIONS_SENT;
      await prisma.previewRequestEvent.create({
        data: {
          previewRequestId: ctxResult.ctx.request.id,
          action,
          meta: { section: parsed.data.section, reviewId: review.id },
        },
      });
      if (!ctxResult.ctx.isOperator) {
        await sendServerAnalyticsEvent({
          name:
            parsed.data.action === 'confirmed'
              ? FUNNEL_EVENTS.hub_review_confirmed
              : FUNNEL_EVENTS.hub_review_corrections_sent,
          clientId: analyticsClientIdFromRequest(request),
          params: { section: parsed.data.section },
        });
      }
      return hubJson({ ok: true, review, changeRoundsUsed: after?.changeRoundsUsed ?? usedBefore }, 201);
    } catch (error) {
      console.error('[preview-hub] review failed', {
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { GET, POST };
}
