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

/**
 * AI search and answer crawlers get explicit allow groups with the same private-path rules.
 * Training-only crawlers (GPTBot, CCBot, Google-Extended) are deliberately not named: they fall under `*`.
 */
export const AI_SEARCH_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
] as const;

export const GET: APIRoute = () => {
  const siteUrl = getPublicSiteUrl();

  const body = [
    ...AI_SEARCH_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, 'Allow: /', ...PRIVATE_PATH_RULES, '']),
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
