export const prerender = false;

import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
