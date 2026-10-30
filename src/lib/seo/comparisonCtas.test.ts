import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COMPARISON_FINAL_CTA_HEADING,
  COMPARISON_HERO_PRIMARY_HREF,
  COMPARISON_HERO_PRIMARY_LABEL,
  COMPARISON_HERO_SECONDARY_HREF,
  COMPARISON_HERO_SECONDARY_LABEL,
  comparisonFinalCtaSwitchLabel,
} from './comparisonCtas';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../..');
const read = (path: string) => readFileSync(join(src, path), 'utf8');

const finalCta = read('components/comparison/ComparisonFinalCta.astro');
const heroActions = read('components/comparison/ComparisonHeroActions.astro');

/** Page → hero source that must render ComparisonHeroActions, with its placement and competitor. */
const PAGES = [
  { page: 'pages/compare/index.astro', hero: 'components/alternativesHub/HubHero.astro', placement: 'compare_hub' },
  { page: 'pages/barber-software-cost-calculator/index.astro', hero: 'components/costCalculator/CostCalcHero.astro', placement: 'cost_calculator' },
  { page: 'pages/booksy-alternative/index.astro', hero: 'components/booksyAlternative/BooksyHero.astro', placement: 'booksy', competitor: 'Booksy' },
  { page: 'pages/fresha-alternative/index.astro', hero: 'components/freshaAlternative/FreshaHero.astro', placement: 'fresha', competitor: 'Fresha' },
  { page: 'pages/treatwell-alternative/index.astro', hero: 'components/treatwellAlternative/TreatwellHero.astro', placement: 'treatwell', competitor: 'Treatwell' },
  { page: 'pages/nearcut-alternative/index.astro', hero: 'components/nearcutAlternative/NearcutHero.astro', placement: 'nearcut', competitor: 'Nearcut' },
  { page: 'pages/vagaro-alternative/index.astro', hero: 'components/vagaroAlternative/VagaroHero.astro', placement: 'vagaro', competitor: 'Vagaro' },
  { page: 'pages/timely-alternative/index.astro', hero: 'pages/timely-alternative/index.astro', placement: 'timely', competitor: 'Timely' },
  { page: 'pages/phorest-alternative/index.astro', hero: 'components/phorestAlternative/PhorestHero.astro', placement: 'phorest', competitor: 'Phorest' },
  { page: 'pages/square-appointments-alternative/index.astro', hero: 'components/squareAlternative/SquareHero.astro', placement: 'square', competitor: 'Square Appointments' },
  { page: 'pages/squire-alternative/index.astro', hero: 'components/squireAlternative/SquireHero.astro', placement: 'squire', competitor: 'SQUIRE' },
  { page: 'pages/setora-alternative/index.astro', hero: 'components/setoraAlternative/SetoraHero.astro', placement: 'setora', competitor: 'Setora' },
] as const;

describe('comparison engine CTAs', () => {
  it('leads the closing CTA with Full KERSIVO and keeps Starter as a text link', () => {
    expect(COMPARISON_FINAL_CTA_HEADING).toBe('Move bookings onto your own website');
    expect(finalCta).toContain("import FinalCta from '@/components/FinalCta.astro'");
    expect(finalCta).toContain('{COMPARISON_FINAL_CTA_HEADING}');
    expect(finalCta).toContain("href: '/admin/launch'");
    expect(finalCta).toContain('Start Full KERSIVO — ${monthlyPriceLabel}');
    expect(finalCta.indexOf("href: '/admin/launch'")).toBeLessThan(finalCta.indexOf("href: '/starter'"));
    expect(finalCta).toContain("track: 'saas_subscribe_click'");
    expect(finalCta).toContain("track: 'starter_plan_explore_click'");
    expect(finalCta).toContain('COMPARISON_FINAL_CTA_STARTER_LABEL');
    expect(finalCta).not.toContain('secondary=');
    expect(finalCta).toContain('0% KERSIVO commission. ${STRIPE_FEES_NOTE}');
    expect(comparisonFinalCtaSwitchLabel('Booksy')).toBe('Ask us about switching from Booksy →');
  });

  it('puts Full pricing first and the demo second in every hero', () => {
    expect(COMPARISON_HERO_PRIMARY_LABEL).toBe('See Full KERSIVO pricing');
    expect(COMPARISON_HERO_PRIMARY_HREF).toBe('/pricing#plan');
    expect(COMPARISON_HERO_SECONDARY_LABEL).toBe('See it working');
    expect(COMPARISON_HERO_SECONDARY_HREF).toBe('/demo');
    expect(heroActions.indexOf('COMPARISON_HERO_PRIMARY_HREF}')).toBeLessThan(heroActions.indexOf('COMPARISON_HERO_SECONDARY_HREF}'));
    expect(heroActions).toContain('data-track="view_pricing_click"');
    expect(heroActions).toContain('data-track="view_live_demo_click"');
    expect(heroActions).toContain('data-track-placement={trackPlacement}');
  });

  it('wires both shared components on all twelve comparison pages', () => {
    for (const entry of PAGES) {
      const page = read(entry.page);
      const hero = read(entry.hero);
      expect(hero, entry.hero).toContain(`<ComparisonHeroActions placement="${entry.placement}" />`);
      const expected = 'competitor' in entry
        ? `<ComparisonFinalCta placement="${entry.placement}" competitor="${entry.competitor}" />`
        : `<ComparisonFinalCta placement="${entry.placement}" />`;
      expect(page, entry.page).toContain(expected);
      expect(page, entry.page).not.toContain('/#pricing');
      if ('competitor' in entry) expect(page, entry.page).toContain('<Contact16');
    }
  });

  it('removes the per-page closing CTA components', () => {
    const components = join(src, 'components');
    for (const dir of readdirSync(components)) {
      if (!dir.endsWith('Alternative') && dir !== 'alternativesHub') continue;
      const finals = readdirSync(join(components, dir)).filter((file) => /FinalCta\.astro$/.test(file));
      expect(finals, dir).toEqual([]);
    }
    expect(existsSync(join(components, 'alternativesHub/HubFinalCta.astro'))).toBe(false);
  });
});
