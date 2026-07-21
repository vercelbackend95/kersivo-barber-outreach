export const prerender = false;

import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';
import { acceptInviteForUser } from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';

/**
 * Accept the newest open invite for the signed-in user's email.
 * Safety net when OAuth landed on /admin before the invite token page ran accept.
 */
export const POST: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user?.id || !session.user.email) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 401 });
  }

  const email = session.user.email.trim().toLowerCase();
  const invite = await prisma.shopInvite.findFirst({
    where: {
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      role: { in: ['MANAGER', 'BARBER'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!invite) {
    return new Response(JSON.stringify({ error: 'No pending invitation for this account.' }), {
      status: 404,
    });
  }

  const result = await acceptInviteForUser(invite, session.user.id);

  return new Response(
    JSON.stringify({
      ok: true,
      shopId: result.shopId,
      role: result.role,
      alreadyMember: result.alreadyMember,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
