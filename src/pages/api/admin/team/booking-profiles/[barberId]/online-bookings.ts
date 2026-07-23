export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import { setOnlineBookingsEnabled } from '@/lib/admin/setOnlineBookingsEnabled';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['members.manage', 'catalog.manage']);
  if (denied) return denied;

  const barberId = context.params.barberId;
  if (!barberId) return json({ error: 'Missing booking profile id.' }, 400);

  let body: { enabled?: boolean };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  if (typeof body.enabled !== 'boolean') {
    return json({ error: 'enabled must be a boolean.' }, 400);
  }

  const result = await setOnlineBookingsEnabled({
    shopId: access.shopId,
    barberId,
    enabled: body.enabled,
  });

  if (!result.ok) {
    return json(
      {
        error: result.error,
        code: result.code,
        ...(result.missing ? { missing: result.missing } : {}),
      },
      result.status,
    );
  }

  return json({ ok: true, enabled: result.active, barberId });
};
