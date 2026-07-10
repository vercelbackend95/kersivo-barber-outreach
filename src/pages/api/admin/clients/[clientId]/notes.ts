export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionBarberId, requireAdmin, resolveNoteAuthorBarberId } from '@/lib/admin/auth';
import { clientNoteBaseSelect, mapNoteWithLikes } from '@/lib/admin/clientNoteLikes';
import { prisma } from '@/lib/db/client';
import { storeNoteImage } from '@/lib/storage/storeNoteImage';

const MAX_NOTE_LENGTH = 2000;
const MAX_NOTE_IMAGES = 3;

async function assertClientInShop(clientId: string, shopId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, shopId },
    select: { id: true },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseImageFiles(form: FormData): File[] {
  return form
    .getAll('images')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

async function parseNotePostPayload(ctx: Parameters<APIRoute>[0]) {
  const contentType = ctx.request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await ctx.request.formData();
    const body = String(form.get('body') ?? '').trim();
    const imageFiles = parseImageFiles(form);
    return { body, imageFiles };
  }

  const payload = (await ctx.request.json().catch(() => null)) as { body?: unknown } | null;
  if (!payload || typeof payload.body !== 'string') {
    return null;
  }

  return { body: payload.body.trim(), imageFiles: [] as File[] };
}

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const clientId = ctx.params.clientId;
  if (!clientId) return jsonResponse({ error: 'Missing client id.' }, 400);

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const client = await assertClientInShop(clientId, shop.id);
  if (!client) return jsonResponse({ error: 'Client not found.' }, 404);

  const sessionBarberId = getSessionBarberId(ctx);

  const notes = await prisma.clientNote.findMany({
    where: { clientId },
    orderBy: { createdAt: 'asc' },
    select: {
      ...clientNoteBaseSelect,
      ...(sessionBarberId
        ? {
            likes: {
              where: { barberId: sessionBarberId },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
    },
  });

  return jsonResponse({
    notes: notes.map((note) => mapNoteWithLikes(note, sessionBarberId)),
  });
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const clientId = ctx.params.clientId;
  if (!clientId) return jsonResponse({ error: 'Missing client id.' }, 400);

  const parsed = await parseNotePostPayload(ctx);
  if (!parsed) return jsonResponse({ error: 'Invalid note payload.' }, 400);

  const { body, imageFiles } = parsed;
  if (!body && imageFiles.length === 0) {
    return jsonResponse({ error: 'Note must include text or at least one image.' }, 400);
  }
  if (body.length > MAX_NOTE_LENGTH) {
    return jsonResponse({ error: `Note cannot exceed ${MAX_NOTE_LENGTH} characters.` }, 400);
  }
  if (imageFiles.length > MAX_NOTE_IMAGES) {
    return jsonResponse({ error: `A note can include at most ${MAX_NOTE_IMAGES} images.` }, 400);
  }

  const barberId = resolveNoteAuthorBarberId(ctx);
  if (!barberId) {
    return jsonResponse({ error: 'Barber session required to post notes.' }, 400);
  }

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const client = await assertClientInShop(clientId, shop.id);
  if (!client) return jsonResponse({ error: 'Client not found.' }, 404);

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, active: true },
    select: { id: true },
  });
  if (!barber) {
    return jsonResponse({ error: 'Barber not found.' }, 400);
  }

  const note = await prisma.clientNote.create({
    data: {
      clientId,
      barberId,
      body,
    },
    select: { id: true },
  });

  let imageUrls: string[] = [];
  try {
    imageUrls = await Promise.all(
      imageFiles.map((file, index) => storeNoteImage(file, clientId, note.id, index)),
    );

    if (imageUrls.length > 0) {
      await prisma.clientNoteImage.createMany({
        data: imageUrls.map((url, sortOrder) => ({
          noteId: note.id,
          url,
          sortOrder,
        })),
      });
    }
  } catch (error) {
    await prisma.clientNote.delete({ where: { id: note.id } }).catch(() => undefined);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not upload note images.' },
      400,
    );
  }

  const created = await prisma.clientNote.findUniqueOrThrow({
    where: { id: note.id },
    select: {
      ...clientNoteBaseSelect,
      likes: {
        where: { barberId },
        select: { id: true },
        take: 1,
      },
    },
  });

  return jsonResponse({ note: mapNoteWithLikes(created, barberId) }, 201);
};
