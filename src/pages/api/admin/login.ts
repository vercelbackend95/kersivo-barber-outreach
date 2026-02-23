export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.json();
  const secret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;

  if (!secret || data?.secret !== secret) {
    return new Response(JSON.stringify({ error: 'Invalid secret' }), { status: 401 });
  }

  cookies.set('admin_auth', secret, { httpOnly: true, sameSite: 'lax', path: '/' });
  return new Response(JSON.stringify({ ok: true }));
};
