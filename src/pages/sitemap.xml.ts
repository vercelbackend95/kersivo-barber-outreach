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

const STATIC_PATHS = ['/', '/privacy', '/cookies', '/terms', '/shop'] as const;

function staticEntries(): SitemapEntry[] {
  return STATIC_PATHS.map((path) => ({
    loc: buildAbsoluteUrl(path),
    lastmod: STATIC_SITEMAP_LASTMOD,
  }));
}

export const GET: APIRoute = async () => {
  try {
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
      ...staticEntries(),
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
  } catch (error) {
    // Never 500 the sitemap — static marketing URLs alone are enough for crawl recovery.
    console.error('[sitemap.xml] Falling back to static entries', error);
    return new Response(toSitemapXml(staticEntries()), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
};
