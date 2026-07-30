export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { requirePermission } from '@/lib/admin/rbac/can';
import { approveSiteLaunch } from '@/lib/setup/siteLaunch';

export const POST: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  let body: { confirm?: boolean };
  try {
    body = (await context.request.json()) as { confirm?: boolean };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  if (body.confirm !== true) {
    return new Response(JSON.stringify({ error: 'Explicit confirm required.' }), { status: 400 });
  }

  const email = (access.userEmail ?? '').trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: 'Account email is required.' }), { status: 400 });
  }

  const userId = access.userId?.trim();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Account identity is required.' }), { status: 400 });
  }

  const result = await approveSiteLaunch({
    shopId: access.shopId,
    userId,
    email,
    request: context.request,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: result.status });
  }

  return new Response(
    JSON.stringify({ ok: true, alreadyApproved: result.alreadyApproved ?? false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
