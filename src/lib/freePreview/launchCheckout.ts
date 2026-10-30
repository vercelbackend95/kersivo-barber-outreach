import { z } from 'zod';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { validateDomainChoice } from '@/lib/domains/validateChoice';
import { runGuestSaasCheckout } from '@/lib/setup/guestSaasCheckout';
import { parseCheckoutAttemptId } from '@/lib/setup/saasCheckoutGuard';
import { previewPagePath } from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { currentBookingSystemLabel } from '@/lib/forms/currentBookingSystems';
import { FREE_PREVIEW_BARBER_COUNTS, labelFor } from './intake';
import { persistPreviewDomainChoice } from './persistPreviewDomain';
import { ownerCanActOnPreview, resolvePreviewRequestByToken } from './previewAccess';

/** Stripe Checkout metadata key carrying the PreviewRequest id (shopId carries the draft shop). */
export const PREVIEW_REQUEST_METADATA_KEY = 'previewRequestId';

/** GA client id, present only with Analytics consent: lets the webhook report preview_converted. */
export const PREVIEW_GA_CLIENT_METADATA_KEY = 'gaClientId';

export const PREVIEW_DOMAIN_METADATA_KEY = 'preferredDomain';
export const PREVIEW_DOMAIN_MODE_METADATA_KEY = 'domainMode';

export const previewLaunchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  termsAccepted: z.literal(true),
  checkoutAttemptId: z.string(),
  domainMode: z.enum(['EXISTING', 'KERSIVO_REGISTER']),
  domain: z.string().trim().min(1).max(253),
  domainRegistrationAuthorised: z.boolean().optional(),
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
  domainMode: 'EXISTING' | 'KERSIVO_REGISTER';
  domain: string;
  domainRegistrationAuthorised?: boolean;
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

  const choice = validateDomainChoice({
    domainMode: input.domainMode,
    domain: input.domain,
    domainRegistrationAuthorised: input.domainRegistrationAuthorised,
  });
  if (!choice.ok) return json({ error: choice.error }, 400);

  await persistPreviewDomainChoice({
    shopId: preview.draftShopId,
    preview,
    contactName: input.name,
    choice,
  });

  const gaClientId = analyticsClientIdFromRequest(input.request);
  const response = await runGuestSaasCheckout({
    request: input.request,
    name: input.name.trim(),
    email: preview.email.trim().toLowerCase(),
    shopName: preview.shopName,
    shopSize: labelFor(FREE_PREVIEW_BARBER_COUNTS, preview.barberCount),
    currentStack: `free_preview:${currentBookingSystemLabel(preview.currentBookingSystem)}`.slice(0, 120),
    checkoutAttemptId,
    previewShopId: preview.draftShopId,
    extraMetadata: {
      [PREVIEW_REQUEST_METADATA_KEY]: preview.id,
      [PREVIEW_DOMAIN_MODE_METADATA_KEY]: choice.domainMode,
      [PREVIEW_DOMAIN_METADATA_KEY]: choice.hostname,
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
