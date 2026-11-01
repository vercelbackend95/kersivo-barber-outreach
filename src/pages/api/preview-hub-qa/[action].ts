export const prerender = false;

import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OWNER_TEST_BOOKING_NOTES_PREFIX } from '@/lib/booking/sandboxBookings';
import { prisma } from '@/lib/db/client';
import { listQaEmails } from '@/lib/previewHub/qaEmailLog';
import { isPreviewHubRealQaEnabled } from '@/lib/previewHub/realQa';
import { getLastSubscriptionCheckoutStub } from '@/lib/shop/stripe';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

export const GET: APIRoute = async ({ params, url }) => {
  if (!isPreviewHubRealQaEnabled()) return json({ ok: false }, 404);
  const action = (params.action ?? '').trim();

  if (action === 'stripe') {
    return json({ ok: true, stub: getLastSubscriptionCheckoutStub() });
  }

  if (action === 'seed') {
    const seedPath = join(process.cwd(), '.preview-hub-seed.json');
    try {
      const raw = await readFile(seedPath, 'utf8');
      return json({ ok: true, ...JSON.parse(raw) });
    } catch {
      return json({ ok: false, error: 'Seed file missing.' }, 404);
    }
  }

  if (action === 'admin-api-inventory') {
    const { formatAdminApiAllowlistTable, listAdminApiEndpoints, listAdminHubApiEndpoints } = await import(
      '@/lib/adminHub/adminApiInventory'
    );
    const rows = listAdminApiEndpoints();
    return json({
      ok: true,
      rows,
      hubRows: listAdminHubApiEndpoints(),
      table: formatAdminApiAllowlistTable(rows),
    });
  }

  if (action === 'shop-state') {
    const shopId = (url.searchParams.get('shopId') ?? '').trim();
    if (!shopId) return json({ ok: false }, 400);
    const { shopAcceptsPublicBookings } = await import('@/lib/setup/shopPublicBookingGate');
    const [shop, services, barbers, products, members, acceptingBookings] = await Promise.all([
      prisma.shopSettings.findUnique({
        where: { id: shopId },
        select: {
          id: true,
          name: true,
          ownerUserId: true,
          retailEnabled: true,
          retailOnboardingCompleted: true,
          publicActivityPaused: true,
          publicActivityPauseReason: true,
        },
      }),
      prisma.service.findMany({
        where: { shopId },
        select: { id: true, name: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.barber.findMany({
        where: { shopId },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.product.findMany({
        where: { shopId },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.shopMember.findMany({
        where: { shopId },
        select: { userId: true, role: true },
      }),
      shopAcceptsPublicBookings(shopId),
    ]);
    if (!shop) return json({ ok: false }, 404);
    return json({ ok: true, shop, services, barbers, products, members, acceptingBookings });
  }

  if (action === 'hours') {
    const shopId = (url.searchParams.get('shopId') ?? '').trim();
    if (!shopId) return json({ ok: false }, 400);
    const rows = await prisma.shopOpeningHours.findMany({
      where: { shopId },
      select: { dayOfWeek: true, active: true },
    });
    const { previewHoursFromRows } = await import('@/lib/freePreview/previewBookingSlots');
    return json({ ok: true, hours: previewHoursFromRows(rows) });
  }

  if (action === 'request') {
    const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) return json({ ok: false }, 400);
    const row = await prisma.previewRequest.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
      select: { id: true, publicToken: true, status: true, shopName: true },
    });
    if (!row) return json({ ok: false }, 404);
    return json({ ok: true, id: row.id, token: row.publicToken, status: row.status, shopName: row.shopName });
  }

  if (action === 'emails') {
    const to = (url.searchParams.get('to') ?? '').trim().toLowerCase();
    const logged = listQaEmails(to || undefined);
    if (logged.length) {
      return json({ ok: true, emails: logged });
    }
    const rows = await prisma.emailOutbound.findMany({
      where: to ? { toEmail: to } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, toEmail: true, purpose: true, provider: true, subject: true, payload: true, createdAt: true },
    });
    return json({
      ok: true,
      emails: rows.map((row) => {
        const payload = (row.payload ?? {}) as { html?: string };
        return {
          id: row.id,
          to: row.toEmail,
          purpose: row.purpose,
          provider: row.provider,
          subject: row.subject,
          html: payload.html ?? '',
          createdAt: row.createdAt,
        };
      }),
    });
  }

  return json({ ok: false }, 404);
};

export const POST: APIRoute = async ({ params, request }) => {
  if (!isPreviewHubRealQaEnabled()) return json({ ok: false }, 404);
  const action = (params.action ?? '').trim();
  if (action !== 'test-booking') return json({ ok: false }, 404);

  const body = (await request.json().catch(() => null)) as { shopId?: string } | null;
  const shopId = (body?.shopId ?? '').trim();
  if (!shopId) return json({ ok: false }, 400);

  const [service, barber] = await Promise.all([
    prisma.service.findFirst({
      where: { shopId, isActive: true },
      select: { id: true, durationMinutes: true },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.barber.findFirst({
      where: { shopId, active: true },
      select: { id: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  if (!service || !barber) return json({ ok: false, error: 'Shop is missing a service or barber.' }, 400);

  const startAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  startAt.setUTCHours(10, 0, 0, 0);
  const booking = await prisma.booking.create({
    data: {
      serviceId: service.id,
      barberId: barber.id,
      fullName: 'QA Test Client',
      email: 'qa.test@hubqa.test',
      startAt,
      endAt: new Date(startAt.getTime() + service.durationMinutes * 60 * 1000),
      notes: OWNER_TEST_BOOKING_NOTES_PREFIX,
      status: 'BOOKED',
    },
    select: { id: true },
  });
  return json({ ok: true, bookingId: booking.id });
};
