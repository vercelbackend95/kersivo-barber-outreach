import { describe, expect, it } from 'vitest';
import { FAQ_SCHEMA_OWNERS } from '@/lib/seo/faqSchemaOwners';
import { buildBarbershopBookingFaqJsonLd, buildOnlineBookingFaqJsonLd } from '@/lib/seo/barbershopBookingFaq';
import { buildPricingFaqJsonLd } from '@/lib/seo/pricingPage';
import { buildAlternativesHubFaqJsonLd } from '@/lib/seo/alternativesHubJsonLd';
import { buildBooksyAlternativeFaqJsonLd } from '@/lib/seo/booksyAlternativeFaq';
import { buildVagaroAlternativeFaqJsonLd } from '@/lib/seo/vagaroAlternativeFaq';
import { buildNearcutAlternativeFaqJsonLd } from '@/lib/seo/nearcutAlternativeFaq';
import { buildTimelyAlternativeFaqJsonLd } from '@/lib/seo/timelyAlternativeFaq';
import { buildPhorestAlternativeFaqJsonLd } from '@/lib/seo/phorestAlternativeFaq';
import { buildFreshaAlternativeFaqJsonLd } from '@/lib/seo/freshaAlternativeFaq';
import { buildTreatwellAlternativeFaqJsonLd } from '@/lib/seo/treatwellAlternativeFaq';
import { buildBarberCostCalculatorFaqJsonLd } from '@/lib/seo/barberCostCalculatorFaq';
import { buildSquareAlternativeFaqJsonLd } from '@/lib/seo/squareAlternativeFaq';
import { buildBooksyVsFreshaJsonLd } from '@/lib/seo/booksyVsFresha';

type Node = Record<string, unknown>;

function questions(node: Node | Node[]): string[] {
  const nodes = Array.isArray(node) ? node : [node];
  return nodes
    .filter((n) => n['@type'] === 'FAQPage')
    .flatMap((n) => (n.mainEntity as Array<{ name: string }>).map((q) => q.name.trim()));
}

function markedUp(freePreview: boolean): Record<string, string[]> {
  return {
    '/': questions(buildBarbershopBookingFaqJsonLd(freePreview)),
    '/barbershop-online-booking': questions(buildOnlineBookingFaqJsonLd()),
    '/pricing': questions(buildPricingFaqJsonLd(freePreview)),
    '/compare': questions(buildAlternativesHubFaqJsonLd()),
    '/booksy-alternative': questions(buildBooksyAlternativeFaqJsonLd()),
    '/vagaro-alternative': questions(buildVagaroAlternativeFaqJsonLd()),
    '/nearcut-alternative': questions(buildNearcutAlternativeFaqJsonLd()),
    '/timely-alternative': questions(buildTimelyAlternativeFaqJsonLd()),
    '/phorest-alternative': questions(buildPhorestAlternativeFaqJsonLd()),
    '/fresha-alternative': questions(buildFreshaAlternativeFaqJsonLd()),
    '/treatwell-alternative': questions(buildTreatwellAlternativeFaqJsonLd()),
    '/barber-software-cost-calculator': questions(buildBarberCostCalculatorFaqJsonLd()),
    '/square-appointments-alternative': questions(buildSquareAlternativeFaqJsonLd()),
    '/booksy-vs-fresha': questions(buildBooksyVsFreshaJsonLd()),
  };
}

describe('FAQPage questions are marked up once per site', () => {
  for (const freePreview of [false, true]) {
    it(`marks up each shared question on its owner page only (free preview ${freePreview ? 'on' : 'off'})`, () => {
      const pages = markedUp(freePreview);
      const seen = new Map<string, string[]>();
      for (const [path, list] of Object.entries(pages)) {
        for (const q of list) seen.set(q, [...(seen.get(q) ?? []), path]);
      }
      const duplicates = [...seen].filter(([, paths]) => paths.length > 1);
      expect(duplicates).toEqual([]);
    });
  }

  it('keeps every owned question in its owner page markup', () => {
    const pages = markedUp(false);
    for (const [question, owner] of Object.entries(FAQ_SCHEMA_OWNERS)) {
      expect(pages[owner], `${owner} should mark up "${question}"`).toContain(question);
    }
  });
});
