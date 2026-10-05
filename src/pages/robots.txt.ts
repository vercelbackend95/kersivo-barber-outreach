import type { APIRoute } from 'astro';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/** A named group replaces `*` for that crawler, so each group repeats the private-path rules. */
const PRIVATE_PATH_RULES = [
  'Disallow: /ops',
  'Disallow: /api/',
  'Disallow: /setup/',
  'Disallow: /shop/success',
  'Disallow: /shop/cancelled',
  'Disallow: /shop/*/success',
  'Disallow: /shop/*/cancelled',
  // Dynamic QR redirects. /book/ stays crawlable so its noindex directive can be seen.
  'Disallow: /q/',
] as const;

export const GET: APIRoute = () => {
  const siteUrl = getPublicSiteUrl();

  const body = [
    'User-agent: OAI-SearchBot',
    'Allow: /',
    ...PRIVATE_PATH_RULES,
    '',
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PATH_RULES,
    '',
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
