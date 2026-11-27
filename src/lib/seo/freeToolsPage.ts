/**
 * /free-tools: one page that lists every free KERSIVO calculator and template, grouped by the job a
 * barber is trying to do. Every tool in the "Free tools" navigation group must appear here
 * (asserted in freeToolsPage.test.ts).
 */
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { PRICE_CALCULATOR_PAGE_PATH } from '@/lib/seo/priceCalculatorPage';
import { PRICE_LIST_PAGE_PATH } from '@/lib/seo/priceListTemplatePage';
import { NO_SHOW_CALCULATOR_PAGE_PATH } from '@/lib/seo/noShowCalculatorPage';
import { CANCELLATION_POLICY_PAGE_PATH } from '@/lib/seo/cancellationPolicyTemplatePage';
import { CHAIR_RENT_CALCULATOR_PAGE_PATH } from '@/lib/seo/chairRentCalculatorPage';
import { BARBER_COST_CALCULATOR_PAGE_PATH } from '@/lib/seo/barberCostCalculatorPage';
import { BARBER_TAX_CALCULATOR_PAGE_PATH } from '@/lib/seo/barberTaxCalculatorPage';

export const FREE_TOOLS_PAGE_PATH = '/free-tools';
export const FREE_TOOLS_LAST_UPDATED_ISO = '2026-11-27';
export const FREE_TOOLS_LAST_UPDATED_LABEL = '27 November 2026';
export const FREE_TOOLS_BREADCRUMB_NAME = 'Free tools';
export const FREE_TOOLS_TITLE = 'Free Tools for UK Barbershops: Calculators & Templates';
export const FREE_TOOLS_DESCRIPTION =
  'Free calculators and templates for UK barbers: prices, no-show costs, chair rent vs commission, self-employed tax, price lists and cancellation policies.';
export const FREE_TOOLS_H1 = 'Free tools for barbershops';
export const FREE_TOOLS_EYEBROW = 'Free tools · No sign-up';
export const FREE_TOOLS_LEAD =
  'Calculators and templates for the sums and paperwork behind a busy chair: what to charge, what no-shows cost, chair rent or commission, the tax to put aside, and the price list and cancellation policy your clients see. All free, with no account or email needed.';

export type FreeToolKind = 'Calculator' | 'Template';

export type FreeTool = {
  href: string;
  label: string;
  kind: FreeToolKind;
  description: string;
};

export type FreeToolGroup = {
  id: string;
  /** The question the barber is asking. */
  heading: string;
  tools: readonly FreeTool[];
};

export const FREE_TOOL_GROUPS: readonly FreeToolGroup[] = [
  {
    id: 'pricing',
    heading: 'Setting or raising your prices',
    tools: [
      {
        href: PRICE_CALCULATOR_PAGE_PATH,
        label: 'Barber price calculator',
        kind: 'Calculator',
        description: 'Work out what to charge for each service from your costs, hours and how busy you are, then test a price rise.',
      },
      {
        href: PRICE_LIST_PAGE_PATH,
        label: 'Price list template',
        kind: 'Template',
        description: 'Lay out your services and prices to print for the wall or copy for Instagram and Google.',
      },
    ],
  },
  {
    id: 'tax',
    heading: 'Putting money aside for tax',
    tools: [
      {
        href: BARBER_TAX_CALCULATOR_PAGE_PATH,
        label: 'Self-employed barber tax calculator',
        kind: 'Calculator',
        description: 'Work out your Income Tax and National Insurance, what to put aside each week and what is due in January.',
      },
    ],
  },
  {
    id: 'no-shows',
    heading: 'Cutting no-shows and late cancellations',
    tools: [
      {
        href: NO_SHOW_CALCULATOR_PAGE_PATH,
        label: 'No-show cost calculator',
        kind: 'Calculator',
        description: 'See what missed appointments cost you in a year and whether a deposit would pay for itself.',
      },
      {
        href: CANCELLATION_POLICY_PAGE_PATH,
        label: 'Cancellation policy template',
        kind: 'Template',
        description: 'Write a deposit, no-show and lateness policy in website, short and one-line versions.',
      },
    ],
  },
  {
    id: 'staff',
    heading: 'Taking on a barber',
    tools: [
      {
        href: CHAIR_RENT_CALCULATOR_PAGE_PATH,
        label: 'Chair rent vs commission calculator',
        kind: 'Calculator',
        description: 'Compare employing a barber on commission with renting out the chair, including minimum wage and employer costs.',
      },
    ],
  },
  {
    id: 'software',
    heading: 'Choosing booking software',
    tools: [
      {
        href: BARBER_COST_CALCULATOR_PAGE_PATH,
        label: 'Barber software cost calculator',
        kind: 'Calculator',
        description: 'Compare what Booksy, Fresha, Nearcut and KERSIVO would cost with your own shop numbers.',
      },
    ],
  },
];

export const FREE_TOOLS: readonly FreeTool[] = FREE_TOOL_GROUPS.flatMap((group) => group.tools);

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${FREE_TOOLS_PAGE_PATH}`;
}

export function buildFreeToolsJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#webpage`,
      url,
      name: FREE_TOOLS_TITLE,
      description: FREE_TOOLS_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: FREE_TOOLS_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#tools` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${url}#tools`,
      name: 'Free tools for UK barbershops',
      itemListElement: FREE_TOOLS.map((tool, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tool.label,
        url: `${siteUrl}${tool.href}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: FREE_TOOLS_BREADCRUMB_NAME, item: url },
      ],
    },
  ];
}
