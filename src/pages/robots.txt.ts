import type { APIRoute } from 'astro';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const GET: APIRoute = () => {
  const siteUrl = getPublicSiteUrl();

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /book',
    'Disallow: /api/',
    'Disallow: /setup/',
    'Disallow: /shop/success',
    'Disallow: /shop/cancelled',
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
