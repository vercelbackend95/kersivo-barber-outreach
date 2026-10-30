import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { offer } from '@/content/offer';
import { FREE_PREVIEW_STEPS, FULL_SETUP_STEPS } from '@/content/setupSteps';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

const SRC = join(process.cwd(), 'src');
const STRIPE_SENTENCE = offer.fees.stripe;
const SUBSCRIBE_LABEL = offer.cta.subscribe;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, acc);
    } else if (/\.(ts|tsx|astro|mjs|js)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('offer content module', () => {
  it('holds the canonical commercial strings', () => {
    expect(offer.price.full).toBe(`£${SAAS_MONTHLY_GBP}/month`);
    expect(offer.price.fullQualifier).toBe('per location');
    expect(offer.price.starter).toBe('£0/month');
    expect(offer.fees.stripe).toBe('Standard Stripe payment-processing fees apply to online payments.');
    expect(offer.fees.commission).toBe('0% KERSIVO commission');
    expect(offer.fees.setup).toBe('No setup fee');
    expect(offer.fees.vat).toBe('KERSIVO is not currently VAT registered, so no VAT is added.');
    expect(offer.billing.cycle).toBe('Billed today, then monthly on the same day. Cancel anytime.');
    expect(offer.billing.refund).toContain("we'll refund your initial");
    expect(offer.cta.primary).toBe('Get my free preview');
    expect(offer.cta.subscribe).toBe(`Or subscribe now — £${SAAS_MONTHLY_GBP}/month`);
    expect(offer.plans.full).toBe('Full KERSIVO');
    expect(offer.plans.starter).toBe('KERSIVO Starter');
  });

  it('defines the Stripe fees sentence only in the content module (plus tests)', () => {
    const hits = walk(SRC)
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => source.includes(STRIPE_SENTENCE))
      .map(({ file }) => relative(process.cwd(), file).replaceAll('\\', '/'));

    const unexpected = hits.filter(
      (file) =>
        file !== 'src/content/offer.ts' &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx'),
    );
    expect(unexpected).toEqual([]);
    expect(hits).toContain('src/content/offer.ts');
  });

  it('shares one four-step setup process', () => {
    expect(FREE_PREVIEW_STEPS).toHaveLength(4);
    expect(FULL_SETUP_STEPS).toHaveLength(4);
    expect(FULL_SETUP_STEPS.map((step) => step.title)).toEqual([
      'Start your Full KERSIVO subscription',
      'Tell us about your shop',
      'We prepare your KERSIVO setup',
      'Review, approve and launch',
    ]);
  });
});

describe('Or subscribe now placement', () => {
  it('keeps the exact subscribe-now label in the content module only', () => {
    expect(SUBSCRIBE_LABEL).toMatch(/^Or subscribe now — £\d+\/month$/);
    const hits = walk(SRC)
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => source.includes('Or subscribe now —'))
      .map(({ file }) => relative(process.cwd(), file).replaceAll('\\', '/'));
    const unexpected = hits.filter(
      (file) =>
        file !== 'src/content/offer.ts' &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx') &&
        file !== 'src/lib/freePreview/fullPlanCta.ts' &&
        file !== 'src/components/cta/FullPlanCta.astro' &&
        file !== 'src/lib/nav/footerNavigation.ts',
    );
    expect(unexpected).toEqual([]);
  });
});
