export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission, type AdminAccess } from '@/lib/admin/auth';
import { prisma } from '@/lib/db/client';
import { deliverOutboxEmail } from '@/lib/email/outbox';
import {
  QR_KIT_BLOCKER_MESSAGES,
  QR_KIT_REQUEST_RECEIVED_MESSAGE,
  evaluateQrKitShopEligibility,
  loadQrKitShopFacts,
  requestInitialQrKit,
} from '@/lib/qr/qrKitFulfilment';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Guest preview / secret access can never request a physical kit. */
function sessionEmailVerified(access: AdminAccess): boolean {
  return access.via === 'session' && access.emailVerified;
}

/**
 * Customer-facing QR Kit API. Deliberately exposes only eligibility and "request received" —
 * never fulfilment status, internal notes, tracking or costs.
 */
export const GET: APIRoute = async (context) => {
  const access = await requireAdminPermission(context, 'shop.settings');
  if (access instanceof Response) return access;

  const [existing, facts, onboarding] = await Promise.all([
    prisma.qrKitFulfilment.findUnique({ where: { shopId: access.shopId }, select: { id: true } }),
    loadQrKitShopFacts(access.shopId, { emailVerified: sessionEmailVerified(access) }),
    prisma.clientOnboarding.findUnique({
      where: { shopId: access.shopId },
      select: {
        addressLine1: true,
        addressLine2: true,
        townCity: true,
        postcode: true,
        publicPhone: true,
        primaryContactName: true,
        primaryContactEmail: true,
      },
    }),
  ]);

  if (existing) {
    return json({ requestReceived: true, message: QR_KIT_REQUEST_RECEIVED_MESSAGE });
  }

  const blockers = evaluateQrKitShopEligibility(facts);
  return json({
    requestReceived: false,
    eligible: blockers.length === 0,
    blockers: blockers.map((code) => ({ code, message: QR_KIT_BLOCKER_MESSAGES[code] })),
    prefill: {
      shopName: facts.shopName,
      contactName: onboarding?.primaryContactName || access.userName || '',
      contactEmail: onboarding?.primaryContactEmail || access.userEmail || '',
      contactPhone: onboarding?.publicPhone || '',
      addressLine1: onboarding?.addressLine1 || '',
      addressLine2: onboarding?.addressLine2 || '',
      townCity: onboarding?.townCity || '',
      postcode: onboarding?.postcode || '',
      countryCode: 'GB',
    },
  });
};

export const POST: APIRoute = async (context) => {
  const access = await requireAdminPermission(context, 'shop.settings');
  if (access instanceof Response) return access;

  const body = await context.request.json().catch(() => null);
  const facts = await loadQrKitShopFacts(access.shopId, {
    emailVerified: sessionEmailVerified(access),
  });
  const result = await requestInitialQrKit({
    shopId: access.shopId,
    userId: access.userId,
    facts,
    input: body,
  });

  if (!result.ok) {
    if (result.reason === 'INELIGIBLE') {
      return json(
        {
          error: 'This shop is not eligible for a QR Kit yet.',
          code: 'QR_KIT_NOT_ELIGIBLE',
          blockers: result.blockers.map((code) => ({ code, message: QR_KIT_BLOCKER_MESSAGES[code] })),
        },
        409,
      );
    }
    return json(
      { error: 'Check the contact and delivery details.', code: 'QR_KIT_INVALID_DETAILS', fields: result.errors },
      400,
    );
  }

  if (result.created && result.outboxId) {
    await deliverOutboxEmail(result.outboxId).catch(() => undefined);
  }

  return json({ requestReceived: true, message: QR_KIT_REQUEST_RECEIVED_MESSAGE });
};
