import type { APIRoute } from 'astro';
import { KERSIVO_COMMISSION_CLAIM, NO_SETUP_FEE_SHORT, PRICE_VAT_DISCLAIMER, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { INSIGHTS_PUBLISHED_ARTICLES } from '@/lib/seo/insights';
import { KERSIVO_ORGANIZATION_DESCRIPTION } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

/**
 * /llms.txt (llmstxt.org): a plain summary of KERSIVO with links to the pages that answer
 * buyer questions. Every claim comes from claimsPolicy / defaults, so it cannot drift from the site.
 */
export function buildLlmsTxt(siteUrl: string): string {
  const link = (path: string, label: string, note: string) => `- [${label}](${siteUrl}${path}): ${note}`;
  return [
    '# KERSIVO',
    '',
    `> ${KERSIVO_ORGANIZATION_DESCRIPTION} Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location and includes a branded website on the shop's own domain with online booking. KERSIVO Starter is £0/month: a KERSIVO-hosted booking page for up to 4 barbers, where every public booking takes a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or full payment through the shop's own Stripe account. ${KERSIVO_COMMISSION_CLAIM} ${STRIPE_FEES_NOTE}`,
    '',
    `Prices are per physical location, not per barber. ${NO_SETUP_FEE_SHORT} ${PRICE_VAT_DISCLAIMER} Clients book in the browser; there is no customer app and no marketplace listing.`,
    '',
    '## Product',
    link('/pricing', 'Pricing', 'Full KERSIVO and Starter, what each includes, billing and cancellation'),
    link('/barbershop-websites', 'Barbershop websites', 'the branded website, domain and setup process in Full KERSIVO'),
    link('/barbershop-online-booking', 'Online booking', 'how clients book, deposits and payment options on Starter and Full'),
    link('/starter', 'KERSIVO Starter', 'the £0/month plan, its limits and when Full is the better fit'),
    link('/demo', 'Live demo', 'a fictional demo barbershop running on KERSIVO'),
    link('/about', 'About KERSIVO', 'how setup, support and leaving work'),
    '',
    '## Comparisons',
    link('/compare', 'Compare booking systems', '11 UK barber booking systems with sourced, dated prices'),
    link('/barber-software-cost-calculator', 'Cost calculator', 'monthly software and payment costs by team size'),
    link('/booksy-alternative', 'Booksy alternative', 'KERSIVO compared with Booksy'),
    link('/fresha-alternative', 'Fresha alternative', 'KERSIVO compared with Fresha'),
    link('/treatwell-alternative', 'Treatwell alternative', 'KERSIVO compared with Treatwell'),
    '',
    '## Free tools',
    link(
      '/barbershop-cancellation-policy-template',
      'Cancellation policy template',
      'free generator for a barbershop cancellation, deposit and no-show policy in three lengths',
    ),
    '',
    '## Insights',
    ...INSIGHTS_PUBLISHED_ARTICLES.map((article) => link(article.path, article.headline, article.description)),
    '',
    '## Optional',
    link('/terms', 'Terms', 'subscription terms'),
    link('/privacy', 'Privacy policy', 'how personal data is handled'),
    '',
  ].join('\n');
}

export const GET: APIRoute = () =>
  new Response(buildLlmsTxt(getPublicSiteUrl()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
