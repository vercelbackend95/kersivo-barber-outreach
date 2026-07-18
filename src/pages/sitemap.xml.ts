import type { APIRoute } from 'astro';
import { buildMarketingSitemapXml, SITEMAP_CONTENT_TYPE } from '@/lib/seo/marketingSitemap';

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(buildMarketingSitemapXml(), {
    headers: {
      'Content-Type': SITEMAP_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
