import { describe, expect, it } from 'vitest';
import { buildAlternativesHubFaqJsonLd } from '@/lib/seo/alternativesHubJsonLd';
import { ALTERNATIVES_HUB_FAQ_ITEMS } from '@/lib/seo/alternativesHubSeo';
import {
  BOOKING_LINK_CHANNELS_FAQ,
  CONFIRMATIONS_REMINDERS_FAQ,
  MIGRATION_ASSISTANCE_FAQ,
  NO_CUSTOMER_APP_FAQ,
  ONLINE_BOOKING_FAQ_ITEMS,
  buildBarbershopBookingFaqJsonLd,
  getHomepageFaqItems,
} from '@/lib/seo/barbershopBookingFaq';
import { BOOKSY_ALTERNATIVE_FAQ_ITEMS } from '@/lib/seo/booksyAlternativeFaq';
import { buildPricingFaqJsonLd, getPricingFaqItems } from '@/lib/seo/pricingPage';
import { STARTER_FAQ_ITEMS, buildStarterFaqJsonLd } from '@/lib/seo/starterPage';
import { ownedFaqSchemaItem } from '@/lib/seo/faqSchemaOwners';

/**
 * GEO/AEO stage 2 (docs/seo/geo-aeo-2-fan-out-map.md): the sub-questions an AI assistant asks when an
 * owner searches for booking software are answered on each page that owns the search, in the visible
 * FAQ, with one shared wording. A shared question is marked up in FAQPage JSON-LD only on the page
 * that owns it (faqSchemaOwners.ts), so each question appears once in the site's structured data.
 */
type Faq = { question: string; answer: string };
const names = (jsonLd: Record<string, unknown>) =>
  (jsonLd.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q) => [q.name, q.acceptedAnswer.text]);
const pairs = (items: readonly Faq[]) => items.map((item) => [item.question, item.answer]);

describe('query fan-out answers', () => {
  const SHARED = [BOOKING_LINK_CHANNELS_FAQ, CONFIRMATIONS_REMINDERS_FAQ, MIGRATION_ASSISTANCE_FAQ, NO_CUSTOMER_APP_FAQ];

  it('lead with the answer in the first word and stay short enough to quote', () => {
    for (const item of SHARED) {
      expect(item.answer, item.question).toMatch(/^(Yes|No|Full KERSIVO)\b/);
      expect(item.answer.split(/(?<=\.)\s+/).length, item.question).toBeLessThanOrEqual(4);
    }
  });

  it('homepage answers "does it work with Google/Instagram" and "are reminders included", visibly; /barbershop-online-booking marks them up', () => {
    for (const freePreview of [false, true]) {
      const items = getHomepageFaqItems(freePreview);
      expect(items).toContain(BOOKING_LINK_CHANNELS_FAQ);
      expect(items).toContain(CONFIRMATIONS_REMINDERS_FAQ);
      expect(names(buildBarbershopBookingFaqJsonLd(freePreview))).toEqual(pairs(items.filter(ownedFaqSchemaItem('/'))));
    }
  });

  it('/pricing answers "can you move my clients"', () => {
    for (const freePreview of [false, true]) {
      expect(getPricingFaqItems(freePreview)).toContain(MIGRATION_ASSISTANCE_FAQ);
      expect(names(buildPricingFaqJsonLd(freePreview))).toEqual(pairs(getPricingFaqItems(freePreview).filter(ownedFaqSchemaItem('/pricing'))));
    }
  });

  it('/starter answers "does it send reminders" without promising SMS on Starter', () => {
    const reminders = STARTER_FAQ_ITEMS.find((item) => item.question === 'Does KERSIVO Starter send booking reminders?');
    expect(reminders?.answer).toMatch(/^Yes, by email\./);
    expect(reminders?.answer).toContain('SMS appointment reminders within a monthly allowance come with Full KERSIVO');
    expect(names(buildStarterFaqJsonLd())).toEqual(pairs(STARTER_FAQ_ITEMS));
  });

  it('/compare answers "do clients need an app" with the same wording as /booksy-alternative', () => {
    expect(ALTERNATIVES_HUB_FAQ_ITEMS).toContain(NO_CUSTOMER_APP_FAQ);
    expect(BOOKSY_ALTERNATIVE_FAQ_ITEMS).toContain(NO_CUSTOMER_APP_FAQ);
    expect(names(buildAlternativesHubFaqJsonLd()).map(([name]) => name)).toContain(NO_CUSTOMER_APP_FAQ.question);
  });

  it('/barbershop-online-booking keeps the shared answers it already had', () => {
    for (const item of [BOOKING_LINK_CHANNELS_FAQ, CONFIRMATIONS_REMINDERS_FAQ, MIGRATION_ASSISTANCE_FAQ]) {
      expect(ONLINE_BOOKING_FAQ_ITEMS).toContain(item);
    }
  });

  it('never repeats a question within one page', () => {
    const pages: Record<string, readonly Faq[]> = {
      home: getHomepageFaqItems(false),
      pricing: getPricingFaqItems(false),
      starter: STARTER_FAQ_ITEMS,
      compare: ALTERNATIVES_HUB_FAQ_ITEMS,
      booking: ONLINE_BOOKING_FAQ_ITEMS,
      booksy: BOOKSY_ALTERNATIVE_FAQ_ITEMS,
    };
    for (const [page, items] of Object.entries(pages)) {
      const questions = items.map((item) => item.question);
      expect(new Set(questions).size, page).toBe(questions.length);
    }
  });
});
