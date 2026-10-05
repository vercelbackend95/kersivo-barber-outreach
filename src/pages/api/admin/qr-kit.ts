export const prerender = false;

import type { APIRoute } from 'astro';
import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdminPermission, requireVerifiedEmail } from '@/lib/admin/auth';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { prisma } from '@/lib/db/client';
import { TERMS_ACCEPTANCE_PURPOSES } from '@/lib/legal/termsVersion';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { ensureShopBookingSlug } from '@/lib/booking/bookingSlug';
import { ensureShopQrCodesInTx } from '@/lib/qr/shopQrCodes';
import { publicBookingPathFromSlug } from '@/lib/booking/publicBookingPath';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';

const claimSchema = z.object({
  deliveryContactName: z.string().trim().min(2).max(120),
  deliveryPhone: z.string().trim().min(7).max(40),
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  townCity: z.string().trim().min(2).max(120),
  postcode: z.string().trim().min(5).max(12),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizePostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function requireQrKitAccess(ctx: APIContext) {
  const access = await requireAdminPermission(ctx, 'billing.manage');
  if (access instanceof Response) return access;

  if (access.via !== 'session' || isDemoShopId(access.shopId)) {
    return json(
      {
        error: 'The included QR Kit can only be requested from your signed-in KERSIVO workspace.',
        code: 'QR_KIT_NOT_AVAILABLE',
      },
      403,
    );
  }

  const unverified = requireVerifiedEmail(access);
  if (unverified) return unverified;

  const product = await requireAdminProductCapability(access, 'PUBLIC_BOOKING');
  if (product instanceof Response) return product;

  return access;
}

type Eligibility = {
  eligible: boolean;
  reasons: string[];
  existingRequest: {
    requestedAt: string;
    status: string;
  } | null;
};

async function loadEligibility(shopId: string): Promise<Eligibility> {
  const [shop, activeBarbers, activeServices, activeAvailability, legalAcceptance] =
    await Promise.all([
      prisma.shopSettings.findUnique({
        where: { id: shopId },
        select: {
          name: true,
          bookingSlug: true,
          qrKitRequest: {
            select: {
              requestedAt: true,
              status: true,
            },
          },
        },
      }),
      prisma.barber.count({ where: { shopId, active: true } }),
      prisma.service.count({ where: { shopId, isActive: true } }),
      prisma.availabilityRule.count({
        where: {
          active: true,
          barber: { shopId, active: true },
        },
      }),
      prisma.legalAcceptance.count({
        where: {
          shopId,
          purpose: {
            in: [
              TERMS_ACCEPTANCE_PURPOSES.FREE_BOOKING_ACTIVATION,
              TERMS_ACCEPTANCE_PURPOSES.SAAS_CHECKOUT,
              TERMS_ACCEPTANCE_PURPOSES.FULL_TO_STARTER,
            ],
          },
        },
      }),
    ]);

  if (!shop) {
    return {
      eligible: false,
      reasons: ['shop_not_found'],
      existingRequest: null,
    };
  }

  if (shop.qrKitRequest) {
    return {
      eligible: false,
      reasons: ['initial_kit_already_requested'],
      existingRequest: {
        requestedAt: shop.qrKitRequest.requestedAt.toISOString(),
        status: String(shop.qrKitRequest.status),
      },
    };
  }

  const reasons: string[] = [];
  if (shop.name.trim().length < 2) reasons.push('shop_identity_required');
  if (activeBarbers < 1) reasons.push('active_barber_required');
  if (activeServices < 1) reasons.push('active_service_required');
  if (activeAvailability < 1) reasons.push('availability_required');
  if (legalAcceptance < 1) reasons.push('terms_acceptance_required');

  return {
    eligible: reasons.length === 0,
    reasons,
    existingRequest: null,
  };
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireQrKitAccess(ctx);
  if (access instanceof Response) return access;

  const eligibility = await loadEligibility(access.shopId);
  if (eligibility.reasons.includes('shop_not_found')) {
    return json({ error: 'Shop not found.' }, 404);
  }

  return json({
    ...eligibility,
    includedPlacements: ['WINDOW', 'REBOOK'],
    windowTargetMm: { width: 150, height: 170 },
    rebookTargetMm: { width: 100, height: 100 },
  });
};

export const POST: APIRoute = async (ctx) => {
  const access = await requireQrKitAccess(ctx);
  if (access instanceof Response) return access;

  const parsed = claimSchema.safeParse(await ctx.request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'Check the delivery details and try again.', issues: parsed.error.flatten() }, 400);
  }

  const eligibility = await loadEligibility(access.shopId);
  if (eligibility.reasons.includes('shop_not_found')) {
    return json({ error: 'Shop not found.' }, 404);
  }
  if (eligibility.existingRequest) {
    return json(
      {
        error: 'The included initial QR Kit has already been requested for this location.',
        code: 'QR_KIT_ALREADY_REQUESTED',
        request: eligibility.existingRequest,
      },
      409,
    );
  }
  if (!eligibility.eligible) {
    return json(
      {
        error: 'Complete the remaining booking setup before requesting your QR Kit.',
        code: 'QR_KIT_NOT_ELIGIBLE',
        reasons: eligibility.reasons,
      },
      409,
    );
  }

  const email = access.userEmail?.trim().toLowerCase() ?? '';
  if (!email) {
    return json({ error: 'Your account needs an email address before requesting the QR Kit.' }, 400);
  }

  const data = parsed.data;
  const postcode = normalizePostcode(data.postcode);
  let outboxId: string | null = null;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shopQrKitRequest.findUnique({
          where: { shopId: access.shopId },
          select: { id: true, requestedAt: true, status: true },
        });
        if (existing) {
          return {
            kind: 'existing' as const,
            request: existing,
          };
        }

        const slug = await ensureShopBookingSlug(tx, access.shopId);
        const qrCodes = await ensureShopQrCodesInTx(tx, access.shopId);
        const request = await tx.shopQrKitRequest.create({
          data: {
            shopId: access.shopId,
            status: 'REQUESTED',
            deliveryContactName: data.deliveryContactName,
            deliveryPhone: data.deliveryPhone,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2?.trim() || null,
            townCity: data.townCity,
            postcode,
            countryCode: 'GB',
          },
          select: {
            id: true,
            requestedAt: true,
            status: true,
          },
        });

        const addressLines = [
          data.addressLine1,
          data.addressLine2?.trim() || null,
          data.townCity,
          postcode,
          'United Kingdom',
        ].filter((value): value is string => Boolean(value));

        const outbox = await enqueueEmail(tx, {
          shopId: access.shopId,
          purpose: EmailOutboundPurpose.QR_KIT_REQUESTED,
          to: email,
          subject: 'We received your KERSIVO QR Kit request',
          dedupeKey: `qr-kit-requested:${access.shopId}`,
          html: `
            <p>Hi ${escapeHtml(data.deliveryContactName)},</p>
            <p>We received your request for the included KERSIVO Booking QR Kit.</p>
            <p><strong>Delivery address</strong><br />${addressLines.map(escapeHtml).join('<br />')}</p>
            <p>Your kit includes a WINDOW booking QR and a REBOOK QR. KERSIVO will complete the required business and delivery-detail checks before print and dispatch.</p>
            <p>We won't promise a dispatch date until the real print and postage workflow has been verified.</p>
            <p>KERSIVO</p>
          `,
        });
        outboxId = outbox.id;

        return {
          kind: 'created' as const,
          request,
          bookingUrl: `${getPublicSiteUrl()}${publicBookingPathFromSlug(slug)}`,
          placements: qrCodes.map((row) => String(row.placement)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === 'existing') {
      return json(
        {
          error: 'The included initial QR Kit has already been requested for this location.',
          code: 'QR_KIT_ALREADY_REQUESTED',
          request: {
            requestedAt: result.request.requestedAt.toISOString(),
            status: String(result.request.status),
          },
        },
        409,
      );
    }

    await tryDeliverOutboxEmail(outboxId);

    return json(
      {
        ok: true,
        request: {
          requestedAt: result.request.requestedAt.toISOString(),
          status: String(result.request.status),
        },
        bookingUrl: result.bookingUrl,
        includedPlacements: result.placements,
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return json(
        {
          error: 'The included initial QR Kit has already been requested for this location.',
          code: 'QR_KIT_ALREADY_REQUESTED',
        },
        409,
      );
    }
    throw error;
  }
};
