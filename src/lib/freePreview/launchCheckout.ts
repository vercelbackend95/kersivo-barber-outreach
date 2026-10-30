import { z } from 'zod';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { runGuestSaasCheckout } from '@/lib/setup/guestSaasCheckout';
import { parseCheckoutAttemptId } from '@/lib/setup/saasCheckoutGuard';
import { previewPagePath } from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { FREE_PREVIEW_BARBER_COUNTS, FREE_PREVIEW_BOOKING_SYSTEMS, labelFor } from './intake';
import { ownerCanActOnPreview, resolvePreviewRequestByToken } from './previewAccess';

/** Stripe Checkout metadata key carrying the PreviewRequest id (shopId carries the draft shop). */
export const PREVIEW_REQUEST_METADATA_KEY = 'previewRequestId';

/** GA client id, present only with Analytics consent: lets the webhook report preview_converted. */
export const PREVIEW_GA_CLIENT_METADATA_KEY = 'gaClientId';

export const previewLaunchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  termsAccepted: z.literal(true),
  checkoutAttemptId: z.string(),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * "Launch this website — £39/month": the existing Full KERSIVO guest checkout (same price, idempotency,
 * one-open-checkout-per-shop and Terms acceptance), with the checkout email fixed to the request email
 * and the draft shop + preview request ids in the Stripe metadata (spec §7).
 */
export async function startPreviewLaunchCheckout(input: {
  request: Request;
  token: string;
  name: string;
  checkoutAttemptId: string;
  now?: Date;
}): Promise<Response> {
  const now = input.now ?? new Date();
  const preview = await resolvePreviewRequestByToken(input.token);
  if (!preview) return json({ error: 'Not found.' }, 404);

  if (preview.status === 'CONVERTED') {
    return json({ error: 'This website has already been launched.', code: 'ALREADY_CONVERTED', redirectTo: '/admin' }, 409);
  }
  if (!ownerCanActOnPreview(preview, now) || !preview.draftShopId) {
    return json({ error: 'This preview is no longer available.', code: 'PREVIEW_NOT_AVAILABLE' }, 409);
  }

  const checkoutAttemptId = parseCheckoutAttemptId(input.checkoutAttemptId);
  if (!checkoutAttemptId) return json({ error: 'Valid checkoutAttemptId is required.' }, 400);

  const draft = await prisma.shopSettings.findUnique({
    where: { id: preview.draftShopId },
    select: { ownerUserId: true },
  });
  // Only an ownerless draft can be handed over after payment.
  if (!draft || draft.ownerUserId) {
    return json({ error: 'This preview is no longer available.', code: 'PREVIEW_NOT_AVAILABLE' }, 409);
  }

  const gaClientId = analyticsClientIdFromRequest(input.request);
  const response = await runGuestSaasCheckout({
    request: input.request,
    name: input.name.trim(),
    email: preview.email.trim().toLowerCase(),
    shopName: preview.shopName,
    shopSize: labelFor(FREE_PREVIEW_BARBER_COUNTS, preview.barberCount),
    currentStack: `free_preview:${labelFor(FREE_PREVIEW_BOOKING_SYSTEMS, preview.currentBookingSystem)}`.slice(0, 120),
    checkoutAttemptId,
    previewShopId: preview.draftShopId,
    extraMetadata: {
      [PREVIEW_REQUEST_METADATA_KEY]: preview.id,
      ...(gaClientId ? { [PREVIEW_GA_CLIENT_METADATA_KEY]: gaClientId } : {}),
    },
    cancelPath: previewPagePath(input.token),
  });

  if (response.ok) {
    await prisma.previewRequestEvent
      .create({ data: { previewRequestId: preview.id, action: PREVIEW_REQUEST_ACTIONS.CHECKOUT_STARTED } })
      .catch((error) => console.error('[free-preview] checkout event failed', { id: preview.id, error }));
    await sendServerAnalyticsEvent({ name: FUNNEL_EVENTS.preview_checkout_started, clientId: gaClientId });
  }
  return response;
}
