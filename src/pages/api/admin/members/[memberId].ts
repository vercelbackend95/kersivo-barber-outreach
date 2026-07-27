export const prerender = false;

import type { APIRoute } from 'astro';
import type { ShopRole } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin/auth';
import { linkMemberToBarberSeat } from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';

export const DELETE: APIRoute = async (context) => {
  const access = await requireAdminPermission(context, 'members.manage');
  if (access instanceof Response) return access;

  const memberId = context.params.memberId;
  if (!memberId) {
    return new Response(JSON.stringify({ error: 'Missing member id.' }), { status: 400 });
  }

  const member = await prisma.shopMember.findFirst({
    where: { id: memberId, shopId: access.shopId },
  });
  if (!member) {
    return new Response(JSON.stringify({ error: 'Member not found.' }), { status: 404 });
  }

  if (member.role === 'OWNER') {
    return new Response(JSON.stringify({ error: 'Cannot remove an Owner. Transfer ownership is not supported here.' }), {
      status: 403,
    });
  }

  if (member.barberId) {
    await prisma.barber.updateMany({
      where: { id: member.barberId, shopId: access.shopId, userId: member.userId },
      data: { userId: null },
    });
  }

  await prisma.shopMember.delete({ where: { id: member.id } });
  return new Response(JSON.stringify({ ok: true }));
};

export const PATCH: APIRoute = async (context) => {
  const access = await requireAdminPermission(context, 'members.manage');
  if (access instanceof Response) return access;

  const memberId = context.params.memberId;
  if (!memberId) {
    return new Response(JSON.stringify({ error: 'Missing member id.' }), { status: 400 });
  }

  let body: { role?: string; barberId?: string | null };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400 });
  }

  const wantsRole = typeof body.role === 'string';
  const wantsBarberLink = typeof body.barberId === 'string' && body.barberId.trim().length > 0;

  if (!wantsRole && !wantsBarberLink) {
    return new Response(
      JSON.stringify({ error: 'Provide role and/or barberId to update.' }),
      { status: 400 },
    );
  }

  if (wantsBarberLink) {
    const linked = await linkMemberToBarberSeat({
      shopId: access.shopId,
      memberId,
      barberId: String(body.barberId).trim(),
    });
    if (linked instanceof Response) return linked;

    if (!wantsRole) {
      return new Response(JSON.stringify({ ok: true, member: linked }));
    }
  }

  const nextRole = body.role as ShopRole | undefined;
  if (wantsRole) {
    if (access.role !== 'OWNER') {
      return new Response(JSON.stringify({ error: 'Only the Owner can change member roles.' }), {
        status: 403,
      });
    }

    if (nextRole !== 'MANAGER' && nextRole !== 'BARBER') {
      return new Response(JSON.stringify({ error: 'role must be MANAGER or BARBER.' }), {
        status: 400,
      });
    }

    const member = await prisma.shopMember.findFirst({
      where: { id: memberId, shopId: access.shopId },
    });
    if (!member) {
      return new Response(JSON.stringify({ error: 'Member not found.' }), { status: 404 });
    }

    if (member.role === 'OWNER') {
      return new Response(JSON.stringify({ error: 'Cannot change Owner role here.' }), {
        status: 400,
      });
    }

    const updated = await prisma.shopMember.update({
      where: { id: member.id },
      data: { role: nextRole },
      select: {
        id: true,
        role: true,
        barberId: true,
        barber: { select: { id: true, name: true } },
      },
    });

    if (member.barberId) {
      await prisma.barber.updateMany({
        where: { id: member.barberId, shopId: access.shopId },
        data: { intendedRole: nextRole },
      });
    }

    return new Response(JSON.stringify({ ok: true, member: updated }));
  }

  return new Response(JSON.stringify({ ok: true }));
};
