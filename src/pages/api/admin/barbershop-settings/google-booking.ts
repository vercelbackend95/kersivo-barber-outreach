export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminPermissionAndCapability } from '@/lib/admin/productCapability';
import { prisma } from '@/lib/db/client';
import { loadKersivoAccess } from '@/lib/shop/kersivoAccess';
import {
  GOOGLE_BUSINESS_PROFILE_MANAGE_URL,
  resolveGoogleBookingDestination,
  resolveGoogleBookingSetupView,
} from '@/lib/shop/googleBooking';

const updateSchema = z.object({
  action: z.enum(['START_SETUP', 'CONFIRM_CURRENT_URL', 'RESET']),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadGoogleBookingState(shopId: string) {
  const [shop, productAccess] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        bookingSlug: true,
        googleBookingLinkStatus: true,
        googleBookingConfirmedUrl: true,
        googleBookingStatusUpdatedAt: true,
      },
    }),
    loadKersivoAccess(shopId),
  ]);

  if (!shop) return null;

  const destination = resolveGoogleBookingDestination({
    state: productAccess.state,
    shop,
  });
  if (!destination.available) {
    return {
      available: false as const,
      productState: productAccess.state,
    };
  }

  const view = resolveGoogleBookingSetupView({
    status: shop.googleBookingLinkStatus,
    confirmedUrl: shop.googleBookingConfirmedUrl,
    authoritativeUrl: destination.url,
  });

  return {
    available: true as const,
    productState: productAccess.state,
    bookingUrl: destination.url,
    destinationSource: destination.source,
    storedStatus: shop.googleBookingLinkStatus,
    status: view.status,
    requiresUpdate: view.requiresUpdate,
    confirmedUrl: shop.googleBookingConfirmedUrl,
    statusUpdatedAt: shop.googleBookingStatusUpdatedAt?.toISOString() ?? null,
    googleBusinessProfileUrl: GOOGLE_BUSINESS_PROFILE_MANAGE_URL,
  };
}

export const GET: APIRoute = async (context) => {
  const access = await requireAdminPermissionAndCapability(
    context,
    'shop.settings',
    'GOOGLE_BOOKING_SETUP',
  );
  if (access instanceof Response) return access;

  const state = await loadGoogleBookingState(access.shopId);
  if (!state) return json({ error: 'Shop not found.' }, 404);
  if (!state.available) {
    return json(
      {
        error: 'Activate KERSIVO Starter or Full KERSIVO before setting up Google booking.',
        code: 'GOOGLE_BOOKING_NOT_AVAILABLE',
      },
      409,
    );
  }

  return json(state);
};

export const PATCH: APIRoute = async (context) => {
  const access = await requireAdminPermissionAndCapability(
    context,
    'shop.settings',
    'GOOGLE_BOOKING_SETUP',
  );
  if (access instanceof Response) return access;

  const parsed = updateSchema.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'Invalid Google booking setup action.' }, 400);
  }

  const current = await loadGoogleBookingState(access.shopId);
  if (!current) return json({ error: 'Shop not found.' }, 404);
  if (!current.available) {
    return json(
      {
        error: 'Activate KERSIVO Starter or Full KERSIVO before setting up Google booking.',
        code: 'GOOGLE_BOOKING_NOT_AVAILABLE',
      },
      409,
    );
  }

  const now = new Date();
  if (parsed.data.action === 'START_SETUP') {
    await prisma.shopSettings.update({
      where: { id: access.shopId },
      data: {
        googleBookingLinkStatus: 'SETUP_STARTED',
        googleBookingStatusUpdatedAt: now,
      },
    });
  } else if (parsed.data.action === 'CONFIRM_CURRENT_URL') {
    await prisma.shopSettings.update({
      where: { id: access.shopId },
      data: {
        googleBookingLinkStatus: 'MERCHANT_CONFIRMED',
        googleBookingConfirmedUrl: current.bookingUrl,
        googleBookingStatusUpdatedAt: now,
      },
    });
  } else {
    await prisma.shopSettings.update({
      where: { id: access.shopId },
      data: {
        googleBookingLinkStatus: 'NOT_SET',
        googleBookingConfirmedUrl: null,
        googleBookingStatusUpdatedAt: now,
      },
    });
  }

  const next = await loadGoogleBookingState(access.shopId);
  if (!next || !next.available) {
    return json({ error: 'Google booking setup became unavailable.' }, 409);
  }

  return json(next);
};
