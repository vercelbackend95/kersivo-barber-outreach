export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { requireAdminProductCapability } from '@/lib/admin/productCapability';
import { prisma } from '@/lib/db/client';
import { ensureShopBookingSlug } from '@/lib/booking/bookingSlug';
import { publicBookingPathFromSlug } from '@/lib/booking/publicBookingPath';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';

const GOOGLE_BUSINESS_PROFILE_URL = 'https://business.google.com/';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function absoluteBookingUrl(slug: string): string {
  return `${getPublicSiteUrl()}${publicBookingPathFromSlug(slug)}`;
}

async function requireGoogleBookingAccess(ctx: APIContext) {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  if (access.via !== 'session' || isDemoShopId(access.shopId)) {
    return json(
      {
        error: 'Google booking setup is only available in your signed-in KERSIVO workspace.',
        code: 'GOOGLE_BOOKING_NOT_AVAILABLE',
      },
      403,
    );
  }

  const denied = requireAnyPermission(access, ['shop.settings']);
  if (denied) return denied;

  const product = await requireAdminProductCapability(access, 'PUBLIC_BOOKING');
  if (product instanceof Response) return product;

  return access;
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireGoogleBookingAccess(ctx);
  if (access instanceof Response) return access;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      bookingSlug: true,
      googleBookingLinkConfirmedAt: true,
      googleBookingLinkConfirmedUrl: true,
    },
  });
  if (!shop) return json({ error: 'Shop not found.' }, 404);

  const bookingUrl = shop.bookingSlug ? absoluteBookingUrl(shop.bookingSlug) : null;
  const confirmed =
    Boolean(bookingUrl) &&
    Boolean(shop.googleBookingLinkConfirmedAt) &&
    shop.googleBookingLinkConfirmedUrl === bookingUrl;

  return json({
    bookingUrl,
    needsPreparation: !shop.bookingSlug,
    confirmed,
    confirmedAt: confirmed ? shop.googleBookingLinkConfirmedAt?.toISOString() ?? null : null,
    staleConfirmation:
      Boolean(shop.googleBookingLinkConfirmedAt) &&
      (!bookingUrl || shop.googleBookingLinkConfirmedUrl !== bookingUrl),
    googleBusinessProfileUrl: GOOGLE_BUSINESS_PROFILE_URL,
  });
};

export const POST: APIRoute = async (ctx) => {
  const access = await requireGoogleBookingAccess(ctx);
  if (access instanceof Response) return access;

  const body = (await ctx.request.json().catch(() => null)) as { action?: unknown } | null;
  const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : '';
  if (action !== 'prepare' && action !== 'confirm') {
    return json({ error: 'Action must be prepare or confirm.' }, 400);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const slug = await ensureShopBookingSlug(tx, access.shopId);
    const bookingUrl = absoluteBookingUrl(slug);

    if (action === 'confirm') {
      await tx.shopSettings.update({
        where: { id: access.shopId },
        data: {
          googleBookingLinkConfirmedAt: now,
          googleBookingLinkConfirmedUrl: bookingUrl,
        },
      });
    }

    const current = await tx.shopSettings.findUniqueOrThrow({
      where: { id: access.shopId },
      select: {
        googleBookingLinkConfirmedAt: true,
        googleBookingLinkConfirmedUrl: true,
      },
    });

    const confirmed =
      Boolean(current.googleBookingLinkConfirmedAt) &&
      current.googleBookingLinkConfirmedUrl === bookingUrl;

    return {
      bookingUrl,
      confirmed,
      confirmedAt: confirmed ? current.googleBookingLinkConfirmedAt?.toISOString() ?? null : null,
    };
  });

  return json({
    ...result,
    needsPreparation: false,
    staleConfirmation: false,
    googleBusinessProfileUrl: GOOGLE_BUSINESS_PROFILE_URL,
  });
};
