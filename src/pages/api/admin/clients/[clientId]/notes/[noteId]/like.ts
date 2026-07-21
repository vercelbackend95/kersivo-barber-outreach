export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '@/lib/admin/auth';
import { resolveActingBarberId } from '@/lib/admin/rbac/actingBarber';
import { assertClientAccessible } from '@/lib/admin/rbac/scope';
import { prisma } from '@/lib/db/client';

async function assertNoteInClientShop(noteId: string, clientId: string, shopId: string) {
  return prisma.clientNote.findFirst({
    where: {
      id: noteId,
      clientId,
      client: { shopId },
    },
    select: { id: true, isInternal: true },
  });
}

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'clients.write');
  if (access instanceof Response) return access;

  const clientId = ctx.params.clientId;
  const noteId = ctx.params.noteId;
  if (!clientId || !noteId) {
    return new Response(JSON.stringify({ error: 'Missing client or note id.' }), { status: 400 });
  }

  const scoped = await assertClientAccessible(access, clientId);
  if (scoped instanceof Response) return scoped;

  const barberId = resolveActingBarberId(access, ctx);
  if (!barberId) {
    return new Response(JSON.stringify({ error: 'Barber session required to like notes.' }), { status: 400 });
  }

  const note = await assertNoteInClientShop(noteId, clientId, access.shopId);
  if (!note) return new Response(JSON.stringify({ error: 'Note not found.' }), { status: 404 });
  if (access.role === 'BARBER' && note.isInternal) {
    return new Response(JSON.stringify({ error: 'Note not found.' }), { status: 404 });
  }

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, active: true, shopId: access.shopId },
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

  return new Response(
    JSON.stringify({
      likeCount,
      likedByMe: Boolean(
        await prisma.clientNoteLike.findFirst({
          where: { noteId, barberId },
          select: { id: true },
        }),
      ),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
