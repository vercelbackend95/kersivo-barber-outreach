export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionBarberId, requireAdmin, resolveNoteAuthorBarberId } from '@/lib/admin/auth';
import { prisma } from '@/lib/db/client';

async function assertNoteInClientShop(noteId: string, clientId: string, shopId: string) {
  return prisma.clientNote.findFirst({
    where: {
      id: noteId,
      clientId,
      client: { shopId },
    },
    select: { id: true },
  });
}

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const clientId = ctx.params.clientId;
  const noteId = ctx.params.noteId;
  if (!clientId || !noteId) {
    return new Response(JSON.stringify({ error: 'Missing client or note id.' }), { status: 400 });
  }

  const barberId = resolveNoteAuthorBarberId(ctx);
  if (!barberId) {
    return new Response(JSON.stringify({ error: 'Barber session required to like notes.' }), { status: 400 });
  }

  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const note = await assertNoteInClientShop(noteId, clientId, shop.id);
  if (!note) return new Response(JSON.stringify({ error: 'Note not found.' }), { status: 404 });

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, active: true },
    select: { id: true },
  });
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 400 });
  }

  const existing = await prisma.clientNoteLike.findUnique({
    where: { noteId_barberId: { noteId, barberId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.clientNoteLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.clientNoteLike.create({
      data: { noteId, barberId },
    });
  }

  const likeCount = await prisma.clientNoteLike.count({ where: { noteId } });
  const sessionBarberId = getSessionBarberId(ctx);

  return new Response(
    JSON.stringify({
      likeCount,
      likedByMe: sessionBarberId
        ? await prisma.clientNoteLike.findFirst({
            where: { noteId, barberId: sessionBarberId },
            select: { id: true },
          }).then(Boolean)
        : false,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
