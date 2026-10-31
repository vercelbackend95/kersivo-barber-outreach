import { prisma } from '@/lib/db/client';
import { hashPreviewToken, mintPreviewToken } from '@/lib/preview/shopPreviewSession';
import { isPreviewHubEnabled } from './config';
import { PREVIEW_REQUEST_ACTIONS } from './createPreviewRequest';
import { notifyOwnerSubscribed } from './hubLaunch';

export const DIRECT_SUBSCRIBE_ENTRY_POINT = 'direct_subscribe';

export type DirectSubscribeResult =
  | { created: true; previewRequestId: string; publicToken: string }
  | { created: false; reason: 'flag_off' | 'already_has_request' | 'legacy_wizard' | 'no_shop' };

/**
 * New Full subscribers (no PreviewRequest yet) get the same hub + launch checklist.
 * Existing shops that already started or submitted the legacy wizard are left alone.
 */
export function shouldCreateDirectSubscribeHub(input: {
  previewRequestId: string | null;
  onboarding: { status: string; currentStep: number; submittedAt: Date | null } | null;
}): boolean {
  if (input.previewRequestId) return false;
  if (!input.onboarding) return true;
  if (input.onboarding.submittedAt) return false;
  if (input.onboarding.status !== 'DRAFT') return false;
  return input.onboarding.currentStep === 0;
}

export async function ensureDirectSubscribePreviewRequest(input: {
  shopId: string;
  email: string;
  shopName: string;
  townCity?: string | null;
  firstName?: string | null;
  now?: Date;
}): Promise<DirectSubscribeResult> {
  if (!isPreviewHubEnabled()) return { created: false, reason: 'flag_off' };
  const now = input.now ?? new Date();

  const shop = await prisma.shopSettings.findUnique({
    where: { id: input.shopId },
    select: {
      id: true,
      name: true,
      previewRequest: { select: { id: true } },
      clientOnboarding: { select: { status: true, currentStep: true, submittedAt: true, townCity: true } },
    },
  });
  if (!shop) return { created: false, reason: 'no_shop' };
  if (shop.previewRequest) return { created: false, reason: 'already_has_request' };
  if (
    !shouldCreateDirectSubscribeHub({
      previewRequestId: null,
      onboarding: shop.clientOnboarding,
    })
  ) {
    return { created: false, reason: 'legacy_wizard' };
  }

  const publicToken = mintPreviewToken();
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.previewRequest.create({
      data: {
        publicToken,
        publicTokenHash: hashPreviewToken(publicToken),
        status: 'IN_PROGRESS',
        email: input.email,
        shopName: input.shopName || shop.name,
        townCity: input.townCity || shop.clientOnboarding?.townCity || '',
        firstName: input.firstName ?? null,
        authorisationConsentAt: now,
        entryPoint: DIRECT_SUBSCRIBE_ENTRY_POINT,
        convertedAt: now,
        draftShopId: shop.id,
        events: {
          create: [
            {
              action: PREVIEW_REQUEST_ACTIONS.CREATED,
              toStatus: 'IN_PROGRESS',
              meta: { entryPoint: DIRECT_SUBSCRIBE_ENTRY_POINT },
            },
            {
              action: PREVIEW_REQUEST_ACTIONS.HUB_DIRECT_SUBSCRIBE_CREATED,
              toStatus: 'IN_PROGRESS',
            },
            { action: PREVIEW_REQUEST_ACTIONS.CONVERTED, toStatus: 'IN_PROGRESS' },
          ],
        },
      },
      select: { id: true, publicToken: true },
    });
    await tx.clientOnboarding.upsert({
      where: { shopId: shop.id },
      create: {
        shopId: shop.id,
        primaryContactEmail: input.email,
        publicEmail: input.email,
        primaryContactName: input.firstName ?? null,
        townCity: input.townCity || null,
      },
      update: {},
    });
    return created;
  });

  await notifyOwnerSubscribed({
    to: input.email,
    firstName: input.firstName ?? null,
    shopName: input.shopName || shop.name,
    previewRequestId: request.id,
  }).catch((error) =>
    console.error('[preview-hub] subscribed email failed', {
      id: request.id,
      error: error instanceof Error ? error.message : error,
    }),
  );

  return { created: true, previewRequestId: request.id, publicToken: request.publicToken };
}
