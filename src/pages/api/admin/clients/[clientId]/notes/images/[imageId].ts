export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '@/lib/admin/auth';
import { assertClientAccessible } from '@/lib/admin/rbac/scope';
import { prisma } from '@/lib/db/client';
import { retrievePrivateOnboardingFile } from '@/lib/storage/privateOnboardingBlob';
import { isPrivateNoteBlobPathname } from '@/lib/storage/storeNoteImage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Authenticated stream for private client-note images.
 * Legacy public http(s) note URLs are not served here — use them directly in <img>.
 */
export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.read');
  if (access instanceof Response) return access;

  const clientId = ctx.params.clientId?.trim();
  const imageId = ctx.params.imageId?.trim();
  if (!clientId || !imageId) {
    return jsonResponse({ error: 'Missing client or image id.' }, 400);
  }

  const scoped = await assertClientAccessible(access, clientId);
  if (scoped instanceof Response) return scoped;

  const image = await prisma.clientNoteImage.findFirst({
    where: {
      id: imageId,
      note: {
        clientId,
        client: { shopId: access.shopId },
      },
    },
    select: {
      id: true,
      url: true,
    },
  });

  if (!image) {
    return jsonResponse({ error: 'Image not found.' }, 404);
  }

  if (!isPrivateNoteBlobPathname(image.url)) {
    return jsonResponse({ error: 'Image is not a private blob pathname.' }, 400);
  }

  try {
    const blob = await retrievePrivateOnboardingFile(image.url);
    if (!blob.stream || blob.statusCode !== 200) {
      return jsonResponse({ error: 'Image unavailable.' }, blob.statusCode === 404 ? 404 : 502);
    }

    const headers = new Headers();
    headers.set('Content-Type', blob.contentType || 'image/webp');
    headers.set('Cache-Control', 'private, no-store');
    return new Response(blob.stream, { status: 200, headers });
  } catch (error) {
    console.error('[note-image] private blob retrieve failed', error);
    return jsonResponse({ error: 'Image unavailable.' }, 502);
  }
};
