import type { APIRoute } from 'astro';
import { DEMO_ACTION_BLOCKED_MESSAGE, DEMO_ADMIN_MODE_HEADER } from '@/lib/admin/demoConfig';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const GET: APIRoute = () => {
  const siteUrl = getPublicSiteUrl();

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin-demo',
    'Disallow: /demo',
    'Disallow: /book',
    'Disallow: /api/',
    'Disallow: /setup/',
    'Disallow: /shop/success',
    'Disallow: /shop/cancelled',
    'Disallow: /shop/*/success',
    'Disallow: /shop/*/cancelled',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
