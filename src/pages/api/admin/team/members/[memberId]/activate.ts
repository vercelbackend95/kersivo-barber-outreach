export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { prisma } from '@/lib/db/client';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'catalog.manage']);
  if (denied) return denied;

  const memberId = context.params.memberId;
  if (!memberId) return json({ error: 'Missing member id.' }, 400);

  // Orphan calendar barber activate: id like barber:xxx
  if (memberId.startsWith('barber:')) {
    const barberId = memberId.slice('barber:'.length);
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, shopId: access.shopId },
      select: { id: true },
    });
    if (!barber) return json({ error: 'Barber not found.' }, 404);
    await prisma.barber.update({
      where: { id: barberId },
      data: { active: true },
    });
    return json({ ok: true, barberId, teamStatus: 'ACTIVE' });
  }

  const member = await prisma.shopMember.findFirst({
    where: { id: memberId, shopId: access.shopId },
    select: { id: true, barberId: true, teamStatus: true },
  });
  if (!member) return json({ error: 'Member not found.' }, 404);

  await prisma.$transaction(async (tx) => {
    await tx.shopMember.update({
      where: { id: member.id },
      data: { teamStatus: 'ACTIVE' },
    });
    if (member.barberId) {
      await tx.barber.update({
        where: { id: member.barberId },
        data: { active: true },
      });
    }
  });

  return json({ ok: true, memberId: member.id, teamStatus: 'ACTIVE' });
};
