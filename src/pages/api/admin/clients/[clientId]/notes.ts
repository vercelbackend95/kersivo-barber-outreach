export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '@/lib/admin/auth';
import { resolveActingBarberId } from '@/lib/admin/rbac/actingBarber';
import { assertClientAccessible } from '@/lib/admin/rbac/scope';
import { clientNoteBaseSelect, mapNoteWithLikes } from '@/lib/admin/clientNoteLikes';
import { prisma } from '@/lib/db/client';
import { storeNoteImage } from '@/lib/storage/storeNoteImage';

const MAX_NOTE_LENGTH = 2000;
const MAX_NOTE_IMAGES = 3;

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
    const isInternalRaw = String(form.get('isInternal') ?? '').toLowerCase();
    const isInternal = isInternalRaw === '1' || isInternalRaw === 'true';
    return { body, imageFiles, isInternal };
  }

  const payload = (await ctx.request.json().catch(() => null)) as {
    body?: unknown;
    isInternal?: unknown;
  } | null;
  if (!payload || typeof payload.body !== 'string') {
    return null;
  }

  return {
    body: payload.body.trim(),
    imageFiles: [] as File[],
    isInternal: payload.isInternal === true,
  };
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.read');
  if (access instanceof Response) return access;

  const clientId = ctx.params.clientId;
  if (!clientId) return jsonResponse({ error: 'Missing client id.' }, 400);

  const scoped = await assertClientAccessible(access, clientId);
  if (scoped instanceof Response) return scoped;

  const sessionBarberId = resolveActingBarberId(access, ctx);
  const hideInternal = access.role === 'BARBER';

  const notes = await prisma.clientNote.findMany({
    where: {
      clientId,
      ...(hideInternal ? { isInternal: false } : {}),
    },
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
    canMarkInternal: access.role === 'OWNER' || access.role === 'MANAGER',
  });
};

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.write');
  if (access instanceof Response) return access;

  const clientId = ctx.params.clientId;
  if (!clientId) return jsonResponse({ error: 'Missing client id.' }, 400);

  const scoped = await assertClientAccessible(access, clientId);
  if (scoped instanceof Response) return scoped;

  const parsed = await parseNotePostPayload(ctx);
  if (!parsed) return jsonResponse({ error: 'Invalid note payload.' }, 400);

  const { body, imageFiles } = parsed;
  const canMarkInternal = access.role === 'OWNER' || access.role === 'MANAGER';
  const isInternal = canMarkInternal && parsed.isInternal;
  if (!body && imageFiles.length === 0) {
    return jsonResponse({ error: 'Note must include text or at least one image.' }, 400);
  }
  if (body.length > MAX_NOTE_LENGTH) {
    return jsonResponse({ error: `Note cannot exceed ${MAX_NOTE_LENGTH} characters.` }, 400);
  }
  if (imageFiles.length > MAX_NOTE_IMAGES) {
    return jsonResponse({ error: `A note can include at most ${MAX_NOTE_IMAGES} images.` }, 400);
  }

  const barberId = resolveActingBarberId(access, ctx);
  if (!barberId) {
    return jsonResponse(
      {
        error:
          'Your account is not linked to a roster seat. Ask the shop owner to link you in Team before posting notes.',
        code: 'BARBER_NOT_LINKED',
      },
      400,
    );
  }

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, active: true, shopId: access.shopId },
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
      isInternal,
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

