import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { PRICING_FEES_POINTS, PRICING_INCLUDED_GROUPS } from '@/lib/seo/pricingPage';
import { getRateCard1LandingLayout } from '@/lib/pricing/rateCard1Copy';
import {
  BILLING_CYCLE_SHORT,
  KERSIVO_COMMISSION_CLAIM,
} from '@/lib/pricing/claimsPolicy';
import {
  compareCellText,
  getPendingCompareRows,
  getRenderableCompareGroups,
  PRICING_BILLING_COLUMNS,
  PRICING_COMPARE_GROUPS,
  PRICING_FACTS_STRIPE_NOTE,
  PRICING_FULL_FEATURES,
  PRICING_PLAN_CARDS,
  PRICING_REFUND_SENTENCE,
  PRICING_STARTER_DESCRIPTION,
  PRICING_STARTER_FEATURES,
  STARTER_KEY_FACTS,
} from './pricingPlans';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../..');
const read = (path: string) => readFileSync(join(srcDir, path), 'utf8');

const includedBlob = PRICING_INCLUDED_GROUPS.flatMap((group) => [group.title, ...group.items]).join('\n');
const layout = getRateCard1LandingLayout();

describe('/pricing plan cards', () => {
  it('uses the shared key facts for both plans and keeps Full visually primary', () => {
    const card = read('components/pricing/PlanCard.astro');
    expect(card).toContain('<KeyFacts facts={plan.keyFacts} />');
    expect(PRICING_PLAN_CARDS.full.keyFacts.values[0]).toEqual({
      label: 'Monthly fee, per location',
      value: `£${SAAS_MONTHLY_GBP}`,
    });
    expect(PRICING_PLAN_CARDS.starter.keyFacts.values[0]).toEqual({ label: 'Monthly fee', value: '£0' });
    expect(card).toContain('class="btn btn--primary btn--lg"');
    expect(card).toContain('class="btn btn--outline btn--lg"');
  });

  it('shares one surface and facts source with the /starter hero card', () => {
    const card = read('components/pricing/PlanCard.astro');
    const starterPage = read('pages/starter/index.astro');
    expect(card).toContain("isFull ? 'ks-glass-card--accent' : 'ks-glass-card--plain'");
    expect(starterPage).toContain('ks-glass-card ks-glass-card--accent starter-glance-card starter-hero__card');
    expect(starterPage).toContain('<KeyFacts facts={STARTER_KEY_FACTS} />');
    expect(PRICING_PLAN_CARDS.starter.keyFacts).toBe(STARTER_KEY_FACTS);
    expect(read('components/pricing/PricingPlans.astro')).toContain(
      'pricing-billing__item ks-glass-card ks-glass-card--plain',
    );
  });

  it('keeps Stripe fees next to the 0% tile and the tile facts out of the Starter line', () => {
    expect(read('components/pricing/PlanCard.astro')).toContain('{PRICING_FACTS_STRIPE_NOTE}');
    expect(PRICING_FACTS_STRIPE_NOTE).toBe('Stripe fees apply.');
    expect(PRICING_STARTER_DESCRIPTION).not.toMatch(/£5|Up to 4|0%|hosted/i);
    expect(PRICING_STARTER_DESCRIPTION.length).toBeLessThanOrEqual(85);
  });

  it('keeps Full as the first card and Starter as the outline CTA', () => {
    const plans = read('components/pricing/PricingPlans.astro');
    expect(plans.indexOf('variant="full"')).toBeLessThan(plans.indexOf('variant="starter"'));
    expect(plans).toContain('id="plan"');
    expect(PRICING_PLAN_CARDS.starter.primaryCta.track).toBe('starter_signup_click');
    expect(PRICING_PLAN_CARDS.full.chips).toContain(KERSIVO_COMMISSION_CLAIM.replace(/\.$/, ''));
    expect(PRICING_PLAN_CARDS.full.keyFacts.details[0]).toEqual({ label: 'Setup fee', value: 'None' });
  });

  it('takes Full checklist titles from the existing landing included items', () => {
    expect(PRICING_FULL_FEATURES.map((item) => item.title)).toEqual(
      layout.includedItems.map((item) => item.heading),
    );
    expect(PRICING_STARTER_FEATURES).toHaveLength(5);
    const starterBlob = PRICING_STARTER_FEATURES.map((item) => `${item.title} ${item.description}`).join(' ');
    expect(starterBlob).not.toMatch(/own domain|branded website|SMS|Reports|Retail|Advanced Clients|Assistant/i);
  });

  it('keeps the existing Choose-if wording in the Best for lists', () => {
    expect(PRICING_PLAN_CARDS.full.bestFor).toEqual([
      'you want your own website and domain',
      'you want Pay at shop or your own payment rules',
      'you have more than 4 barbers',
      'you want reports, retail pickup and SMS reminders',
    ]);
    expect(PRICING_PLAN_CARDS.starter.bestFor.join(' ')).toContain('up to 4 barbers');
    expect(PRICING_PLAN_CARDS.starter.bestFor.join(' ')).toContain('£5 deposit');
  });
});

describe('/pricing comparison table', () => {
  it('is a real table with caption, thead and row/column headers', () => {
    const table = read('components/pricing/PricingCompareTable.astro');
    expect(table).toContain('id="included"');
    expect(table).toContain('<table class="pricing-compare__table">');
    expect(table).toContain('<caption class="sr-only">');
    expect(table).toContain('<thead>');
    expect(table).toContain('scope="col"');
    expect(table).toContain('scope="row"');
    expect(table).toContain('scope="colgroup"');
    expect(table).toContain('Barbershop software pricing: what each plan includes');
    expect(table).not.toContain('company-groups');
    expect(table).not.toContain('fresha-alt__');
  });

  it('does not render rows that still need founder confirmation', () => {
    const pending = getPendingCompareRows();
    expect(pending.map((row) => row.feature)).toEqual([
      'Hosting, SSL and platform updates',
      'Stripe account',
    ]);
    const rendered = getRenderableCompareGroups().flatMap((group) => group.rows.map((row) => row.feature));
    expect(rendered).not.toContain('Hosting, SSL and platform updates');
    expect(rendered).not.toContain('Stripe account');
    expect(PRICING_COMPARE_GROUPS.flatMap((group) => group.rows)).toHaveLength(rendered.length + pending.length);
  });

  it('sources rendered cell text from existing pricing copy', () => {
    const source = [includedBlob, layout.conditionsLine1, layout.conditionsLine2, ...PRICING_FEES_POINTS].join('\n');
    for (const group of getRenderableCompareGroups()) {
      for (const row of group.rows) {
        for (const cell of [row.starter, row.full]) {
          if (cell.kind === 'text') {
            if (cell.value === 'On your own website') {
              expect(includedBlob).toContain('Your own branded barbershop website');
              continue;
            }
            if (cell.value === 'Pay at shop, £5 deposit or full payment — editable') {
              expect(includedBlob).toContain('Pay at shop, £5 deposit or full payment');
              expect(includedBlob).toContain('Editable booking payment controls');
              continue;
            }
            if (cell.value === 'Rolling 90 days') {
              expect(includedBlob).toContain('Rolling 90-day booking history');
              continue;
            }
            if (cell.value === 'Full history') {
              expect(includedBlob).toContain('Full booking history');
              continue;
            }
            if (cell.value === 'More than 4, fair use') {
              expect(includedBlob).toContain('More than 4 bookable barbers');
              expect(includedBlob).toContain('reasonable fair use');
              continue;
            }
            if (cell.value === 'Included within monthly allowance') {
              expect(includedBlob).toContain('monthly SMS allowance');
              continue;
            }
            if (cell.value === 'Apply') {
              expect(source).toContain('Stripe payment-processing fees');
              continue;
            }
            if (cell.value === `£${SAAS_MONTHLY_GBP} per location`) {
              expect(includedBlob).toContain(`£${SAAS_MONTHLY_GBP}/month per location`);
              continue;
            }
            if (cell.value === 'None') {
              expect(includedBlob).toContain('No setup fee');
              continue;
            }
            if (cell.value === '0%') {
              expect(includedBlob).toContain('0% KERSIVO commission');
              continue;
            }
            if (cell.value === '£0') {
              expect(includedBlob).toContain('£0/month');
              continue;
            }
            if (cell.value === 'Guided') {
              expect(includedBlob).toContain('Guided Google Business Profile booking-link setup');
              continue;
            }
            expect(source, `${row.feature}: ${cell.value}`).toContain(cell.value);
          }
        }
      }
    }
    expect(compareCellText({ kind: 'included' })).toBe('Included');
    expect(compareCellText({ kind: 'excluded' })).toBe('Not included');
  });

  it('draws the Full column as one outline, not a border per row', () => {
    const css = read('styles/components/pricing-compare.css');
    expect(css).not.toContain('box-shadow: inset 0 2px 0 var(--color-brand)');
    expect(css).toContain('.pricing-compare__wrap::after');
    expect(css.slice(css.indexOf('.pricing-compare__wrap {'), css.indexOf('.pricing-compare__wrap::after'))).not.toContain(
      'overflow',
    );
    const table = read('components/pricing/PricingCompareTable.astro');
    expect(table).toContain('<CheckIcon label="Included" />');
    expect(table).toContain('<span class="sr-only">Not included</span>');
  });

  it('keeps a mobile plan switcher with a radio group', () => {
    const table = read('components/pricing/PricingCompareTable.astro');
    expect(table).toContain('role="radiogroup"');
    expect(table).toContain('value="full" checked');
    expect(table).toContain('Show all features');
  });
});

describe('/pricing billing and page clean-up', () => {
  it('moves billing small print into three sourced columns', () => {
    expect(PRICING_BILLING_COLUMNS[0].body).toContain(BILLING_CYCLE_SHORT);
    expect(PRICING_BILLING_COLUMNS[0].body).toContain('Cancel anytime');
    expect(PRICING_BILLING_COLUMNS[1].body).toContain(KERSIVO_COMMISSION_CLAIM);
    expect(PRICING_BILLING_COLUMNS[1].body).toContain('Standard Stripe payment-processing fees apply to online payments');
    expect(PRICING_BILLING_COLUMNS[2].body).toBe(PRICING_REFUND_SENTENCE);
    expect(PRICING_REFUND_SENTENCE).toBe(
      layout.conditionsLine2.slice(layout.conditionsLine2.indexOf("If we're unable")),
    );
  });

  it('drops competitor-page classes from /pricing', () => {
    const page = read('pages/pricing.astro');
    expect(page).not.toContain('RateCard1Offer');
    expect(page).not.toContain('company-groups');
    expect(page).not.toContain('company-checks');
    expect(page).not.toContain('fresha-alt__section');
    expect(page).not.toContain('pricing-starter-offer');
    expect(page).not.toContain('<Faq4');
    expect(page).toContain('<PricingFaq');
    expect(read('components/pricing/PricingFaq.astro')).toContain("import Accordion from '@/components/ui/Accordion.astro'");
  });
});
