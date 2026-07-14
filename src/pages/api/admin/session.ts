export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../lib/admin/auth';

export const GET: APIRoute = async (context) => {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;

  return new Response(
    JSON.stringify({
      ok: true,
      shopId: access.shopId,
      user: access.userId
        ? {
            id: access.userId,
            name: access.userName,
            email: access.userEmail,
            image: access.userImage,
          }
        : null,
      via: access.via,
    }),
  );
};
