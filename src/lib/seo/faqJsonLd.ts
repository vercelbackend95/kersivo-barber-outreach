import { FAQ_ITEMS } from './faqItems';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

function faqAnswerText(item: (typeof FAQ_ITEMS)[number]): string {
  return item.details ? `${item.answer} ${item.details}` : item.answer;
}

export function buildFaqJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerText(item),
      },
    })),
  };
}
