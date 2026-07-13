import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { withPrismaQuotaFallback } from '@/lib/db/resilience';
import { resolveShopId } from '@/lib/db/shopScope';
import { STATIC_SITEMAP_LASTMOD } from '@/lib/seo/defaults';
import { buildAbsoluteUrl } from '@/lib/seo/meta';

type SitemapEntry = {
  loc: string;
  lastmod: string;
};

function toSitemapXml(entries: SitemapEntry[]): string {
  const urlNodes = entries
    .map(
      (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>
`;
}

function formatLastmod(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const GET: APIRoute = async () => {
  const staticPaths = ['/', '/privacy', '/terms', '/shop'];

  const products = await withPrismaQuotaFallback(
    'sitemap.xml.ts',
    async () => {
      const shopId = await resolveShopId();
      return prisma.product.findMany({
        where: { shopId, active: true },
        select: { id: true, updatedAt: true },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      });
    },
    []
  );

  const entries: SitemapEntry[] = [
    ...staticPaths.map((path) => ({
      loc: buildAbsoluteUrl(path),
      lastmod: STATIC_SITEMAP_LASTMOD,
    })),
    ...products.map((product) => ({
      loc: buildAbsoluteUrl(`/shop/${product.id}`),
      lastmod: formatLastmod(product.updatedAt),
    })),
  ];

  return new Response(toSitemapXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
