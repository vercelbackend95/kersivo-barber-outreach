import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { PRICING_FULL_BEST_FOR } from '@/lib/pricing/pricingPlans';
import { PRICING_FIT_QUESTIONS, PRICING_OUTCOMES } from '@/lib/seo/pricingPageContent';
import { clampBarbers, formatPounds, pricePerBarber, recommendPlan, PRICING_SPLIT_MAX, PRICING_SPLIT_MIN } from './pricingMath';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('/pricing fit chooser', () => {
  it('recommends Full for any ticked reason and Starter only after interaction', () => {
    expect(recommendPlan([], false)).toBe('empty');
    expect(recommendPlan([], true)).toBe('starter');
    expect(recommendPlan(['team'], true)).toBe('full');
    expect(recommendPlan(['website', 'tools'], true)).toBe('full');
  });

  it('asks only the approved Full KERSIVO "Best for" reasons', () => {
    expect(PRICING_FIT_QUESTIONS.map((q) => q.label)).toEqual([...PRICING_FULL_BEST_FOR]);
  });
});

describe('/pricing per-barber split', () => {
  it('splits the flat location price and clamps the team size', () => {
    expect(pricePerBarber(SAAS_MONTHLY_GBP, 4)).toBe(9.75);
    expect(pricePerBarber(SAAS_MONTHLY_GBP, 1)).toBe(SAAS_MONTHLY_GBP);
    expect(clampBarbers(0)).toBe(PRICING_SPLIT_MIN);
    expect(clampBarbers(99)).toBe(PRICING_SPLIT_MAX);
    expect(clampBarbers(Number.NaN)).toBe(PRICING_SPLIT_MIN);
    expect(formatPounds(6.5)).toBe('£6.50');
  });
});

describe('/pricing copy safety', () => {
  it('keeps outcomes free of invented numbers and banned claims', () => {
    const copy = PRICING_OUTCOMES.map((o) => `${o.kicker} ${o.title} ${o.body}`).join(' ');
    expect(copy).not.toMatch(/\d+ ?%(?! KERSIVO)|guarantee|unlimited|forever|no-shows? (drop|fall)|\d+ (shops|customers|bookings)/i);
    expect(copy).toContain('monthly allowance');
  });

  it('keeps "Stripe fees apply" next to every 0% claim on the page', () => {
    const sources = [
      'src/components/pricingPage/PricingHero.astro',
      'src/components/pricingPage/PricingPlanCards.astro',
      'src/components/pricingPage/PricingBill.astro',
    ].map(read);
    for (const source of sources) {
      if (source.includes('0%') || source.includes('PRICING_BILL_LINES')) expect(source).toMatch(/Stripe/);
    }
  });

  it('says "a few days" for setup and never a fixed number of days', () => {
    const content = read('src/lib/seo/pricingPageContent.ts');
    expect(content).toContain('Typically ready in a few days once we receive all required information');
    expect(content).not.toMatch(/\d+\s?(–|-|to)?\s?\d*\s?(working )?days|weeks/i);
  });
});
