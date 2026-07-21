export const prerender = false;

import type { APIRoute } from 'astro';
import type { ShopRole } from '@prisma/client';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  assertCanInviteRole,
  createInviteToken,
  inviteExpiresAt,
  resolveBarberSeatForInvite,
} from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { sendShopTeamInviteEmail } from '@/lib/email/sender';

function isShopRole(value: unknown): value is ShopRole {
  return value === 'MANAGER' || value === 'BARBER' || value === 'OWNER';
}

export const POST: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'members.invite_barber']);
  if (denied) return denied;

  let body: {
    email?: string;
    role?: string;
    barberId?: string | null;
    createSeat?: { name?: string } | null;
  };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400 });
  }

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email is required.' }), { status: 400 });
  }

  if (!isShopRole(body.role) || body.role === 'OWNER') {
    return new Response(JSON.stringify({ error: 'role must be MANAGER or BARBER.' }), {
      status: 400,
    });
  }

  const roleDenied = await assertCanInviteRole(access.role, body.role);
  if (roleDenied) return roleDenied;

  let inviteBarberId: string | null = null;
  if (body.role === 'BARBER') {
    const seat = await resolveBarberSeatForInvite({
      shopId: access.shopId,
      email,
      barberId: body.barberId,
      createSeat: body.createSeat,
    });
    if (seat instanceof Response) return seat;
    inviteBarberId = seat;
  }

  const existingMember = await prisma.shopMember.findFirst({
    where: {
      shopId: access.shopId,
      user: { email },
    },
    select: { id: true },
  });
  if (existingMember) {
    return new Response(JSON.stringify({ error: 'This user is already a member of this shop.' }), {
      status: 409,
    });
  }

  const { token, tokenHash } = createInviteToken();
  const invite = await prisma.shopInvite.create({
    data: {
      shopId: access.shopId,
      email,
      role: body.role,
      tokenHash,
      barberId: inviteBarberId,
      invitedByUserId: access.userId,
      expiresAt: inviteExpiresAt(),
    },
    select: { id: true, email: true, role: true, barberId: true, expiresAt: true },
  });

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: { name: true },
  });

  const acceptUrl = `${getPublicSiteUrl()}/admin/invite?token=${encodeURIComponent(token)}`;
  try {
    await sendShopTeamInviteEmail({
      to: email,
      shopName: shop?.name || 'your barbershop',
      role: body.role,
      acceptUrl,
    });
  } catch (error) {
    console.error('[members/invite] email failed', error);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      invite,
      acceptPath: `/admin/invite?token=${encodeURIComponent(token)}`,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  );
};
