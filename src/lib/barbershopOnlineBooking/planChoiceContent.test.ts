import { describe, expect, it } from 'vitest';
import { KERSIVO_COMMISSION_CLAIM, STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  PLAN_CHOICE_BANNED_CLAIMS,
  PLAN_CHOICE_H2,
  PLAN_CHOICE_SECTION_ID,
  buildPlanChoiceContent,
} from './planChoiceContent';

describe('Section 07 plan choice content', () => {
  const content = buildPlanChoiceContent();

  it('exposes the approved H2, anchor id, disclosure and FAQ', () => {
    expect(content.sectionId).toBe(PLAN_CHOICE_SECTION_ID);
    expect(content.sectionId).toBe('booking-options');
    expect(content.h2).toBe(PLAN_CHOICE_H2);
    expect(content.faqs).toHaveLength(5);
    expect(content.disclosure.length).toBeGreaterThanOrEqual(4);
    expect(content).not.toHaveProperty('paths');
  });

  it('states commission, Stripe fees and Full billing transparency', () => {
    const blob = content.disclosure.join(' ');
    expect(blob).toContain(KERSIVO_COMMISSION_CLAIM);
    expect(blob).toContain(STRIPE_FEES_NOTE);
    expect(blob.toLowerCase()).toContain('subscription starts on the day of purchase');
    expect(blob).toContain(`£${SAAS_MONTHLY_GBP}/month`);
    expect(blob).toContain(`£${KERSIVO_BOOKING_DEPOSIT_GBP}`);
  });

  it('keeps FAQ claim-safe and bans retention-as-live automation wording', () => {
    const upgrade = content.faqs.find((faq) => faq.id === 'upgrade');
    expect(upgrade?.answer.join(' ').toLowerCase()).toContain('same underlying kersivo platform');
    expect(upgrade?.answer.join(' ').toLowerCase()).toContain('not an instant launch');

    const pay = content.faqs.find((faq) => faq.id === 'pay');
    expect(pay?.answer.join(' ')).toContain(`£${KERSIVO_BOOKING_DEPOSIT_GBP}`);
    expect(pay?.answer.join(' ').toLowerCase()).toContain('optional for the shop');

    const blob = [
      content.lead,
      content.close,
      ...content.disclosure,
      ...content.faqs.flatMap((faq) => [faq.question, ...faq.answer]),
    ]
      .join(' ')
      .toLowerCase();

    for (const banned of PLAN_CHOICE_BANNED_CLAIMS) {
      expect(blob).not.toContain(banned);
    }
  });
});
