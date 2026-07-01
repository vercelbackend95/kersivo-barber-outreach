import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { withPrismaQuotaFallback } from '@/lib/db/resilience';
import { resolveShopId } from '@/lib/db/shopScope';
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

export const GET: APIRoute = async () => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const staticPaths = ['/', '/privacy', '/terms', '/shop'];

  const productIds = await withPrismaQuotaFallback(
    'sitemap.xml.ts',
    async () => {
      const shopId = await resolveShopId();
      const products = await prisma.product.findMany({
        where: { shopId, active: true },
        select: { id: true },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      });
      return products.map((product) => product.id);
    },
    []
  );

  const entries: SitemapEntry[] = [
    ...staticPaths.map((path) => ({
      loc: buildAbsoluteUrl(path),
      lastmod,
    })),
    ...productIds.map((id) => ({
      loc: buildAbsoluteUrl(`/shop/${id}`),
      lastmod,
    })),
  ];

  return new Response(toSitemapXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
