import type { APIContext } from 'astro';

export function isAdminAuthorized(context: APIContext): boolean {
  const secret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  if (!secret) return false;
  const cookie = context.cookies.get('admin_auth')?.value;
  const header = context.request.headers.get('x-admin-secret');
  return cookie === secret || header === secret;
}

export function requireAdmin(context: APIContext): Response | null {
  if (!isAdminAuthorized(context)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return null;
}
