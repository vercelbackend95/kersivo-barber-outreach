import type { APIRoute } from 'astro';
import { isFreePreviewFlowEnabled } from '@/lib/freePreview/config';
import { buildLlmsFullTxt } from '@/lib/seo/llmsFullTxt';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/** /llms-full.txt: the answers and FAQs from the product and comparison pages in one file. */
export const GET: APIRoute = () =>
  new Response(buildLlmsFullTxt(getPublicSiteUrl(), isFreePreviewFlowEnabled()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
