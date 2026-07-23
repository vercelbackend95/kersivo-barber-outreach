export const prerender = false;

import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';
import { acceptInviteForUser, hashInviteToken } from '@/lib/admin/rbac/members';
import { prisma } from '@/lib/db/client';

/**
 * Accept a shop invite. Bound to invite.shopId (never shop name).
 * Requires a signed-in Better Auth user whose email matches the invite.
 */
export const POST: APIRoute = async (context) => {
  let body: { token?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400 });
  }

  const token = String(body.token || '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token.' }), { status: 400 });
  }

  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user?.id || !session.user.email) {
    return new Response(JSON.stringify({ error: 'Sign in to accept this invitation.' }), {
      status: 401,
    });
  }

  const tokenHash = hashInviteToken(token);
  const invite = await prisma.shopInvite.findUnique({
    where: { tokenHash },
  });

  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'Invitation is invalid or expired.' }), {
      status: 410,
    });
  }

  const sessionEmail = session.user.email.trim().toLowerCase();
  if (sessionEmail !== invite.email.toLowerCase()) {
    return new Response(
      JSON.stringify({
        error: 'Sign in with the invited email address to accept.',
        invitedEmail: invite.email,
      }),
      { status: 403 },
    );
  }

  if (invite.role === 'OWNER') {
    return new Response(JSON.stringify({ error: 'Invalid invite role.' }), { status: 400 });
  }

  // Re-accept after account delete is allowed when invite is not expired and user has no membership
  // (acceptedAt may still be set until reopen, or cleared on delete).
  const result = await acceptInviteForUser(invite, session.user.id);

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error, code: result.code }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (result.alreadyMember) {
    return new Response(
      JSON.stringify({ ok: true, shopId: result.shopId, alreadyMember: true }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, shopId: result.shopId, role: result.role }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
