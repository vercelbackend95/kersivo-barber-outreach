export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../lib/db/client';
import { normalizeQrCode } from '../../lib/qr/shopQrCodes';
import { resolveQrDestination } from '../../lib/qr/qrDestination';
import { hasKersivoCapability, loadKersivoAccess } from '../../lib/shop/kersivoAccess';

/** Destinations change with plan state: never cache, never index. */
const QR_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { ...QR_RESPONSE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Dynamic physical QR redirect. The code identifies shop + placement only; the destination is
 * resolved from current product access on every scan and is always a temporary (302) redirect.
 */
export const GET: APIRoute = async ({ params }) => {
  const code = normalizeQrCode(params.code);
  if (!code) return notFound();

  try {
    const qr = await prisma.shopQrCode.findUnique({
      where: { code },
      select: { shop: { select: { id: true, bookingSlug: true } } },
    });
    if (!qr) return notFound();

    const access = await loadKersivoAccess(qr.shop.id);
    if (!hasKersivoCapability(access, 'PUBLIC_BOOKING')) return notFound();

    const destination = resolveQrDestination({ state: access.state, shop: qr.shop });
    if (destination.kind !== 'redirect') return notFound();

    return new Response(null, {
      status: 302,
      headers: { ...QR_RESPONSE_HEADERS, Location: destination.path },
    });
  } catch (error) {
    console.error('[qr] scan resolution failed', error);
    return new Response('Temporarily unavailable', {
      status: 503,
      headers: { ...QR_RESPONSE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};
