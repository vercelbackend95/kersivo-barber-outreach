import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_PAGE_HERO_ROUTES } from './pageHero';

const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const heroComponent = readFileSync(
  new URL('../../components/demo/DemoPageHero.astro', import.meta.url),
  'utf8',
);

const wrappers = {
  services: readFileSync(new URL('../../components/demo/DemoServicesHero.astro', import.meta.url), 'utf8'),
  barbers: readFileSync(new URL('../../components/demo/DemoBarbersHero.astro', import.meta.url), 'utf8'),
  gallery: readFileSync(new URL('../../components/demo/DemoGalleryHero.astro', import.meta.url), 'utf8'),
  shop: readFileSync(new URL('../../components/demo/DemoShopHero.astro', import.meta.url), 'utf8'),
  contact: readFileSync(new URL('../../components/demo/DemoContactHero.astro', import.meta.url), 'utf8'),
};

describe('BLACKLINE shared page hero', () => {
  it('lists the five primary subpages once', () => {
    expect(DEMO_PAGE_HERO_ROUTES.map((route) => route.path)).toEqual([
      '/demo/services',
      '/demo/barbers',
      '/demo/gallery',
      '/demo/shop',
      '/demo/contact',
    ]);
  });

  it('uses one container formula and does not let the inner stack override width', () => {
    expect(cssSource).toContain('--bl-container-max: 80rem');
    expect(cssSource).toContain('--bl-gutter-mobile: 1.25rem');
    expect(cssSource).toContain('--bl-gutter-tablet: 1.75rem');
    expect(cssSource).toContain('--bl-gutter-desktop: clamp(2.5rem, 4vw, 4rem)');
    expect(cssSource).toContain(
      'width: min(calc(100% - (2 * var(--bl-page-gutter))), var(--bl-container-max))',
    );
    expect(heroComponent).toContain('class="bl-container bl-page-hero-inner"');
    const inner = cssSource.match(
      /\[data-theme='blackline'\] \.bl-page-hero-inner \{[\s\S]*?\n\}/,
    )?.[0];
    expect(inner).toBeTruthy();
    expect(inner).not.toContain('width: 100%');
    expect(inner).not.toContain('100vw');
    expect(cssSource).not.toMatch(/\.bl-page-hero[^{]*\{[^}]*width:\s*100vw/);
  });

  it('gives every primary subpage the same DemoPageHero typography source', () => {
    expect(heroComponent).toContain('<h1 class="bl-page-hero-title"');
    expect(cssSource).toContain('--bl-size-page-hero: clamp(3.75rem, 8vw, 8.75rem)');
    expect(cssSource).toContain('font-size: var(--bl-size-page-hero)');
    expect([...cssSource.matchAll(/font-size: var\(--bl-size-page-hero\)/g)]).toHaveLength(1);
    for (const source of Object.values(wrappers)) {
      expect(source).toContain("from '@/components/demo/DemoPageHero.astro'");
      expect(source).toContain('<DemoPageHero');
    }
  });

  it('removes the per-route hero wrappers that cancelled .bl-container', () => {
    expect(cssSource).not.toMatch(/\.bl-(?:services|barbers|work|contact|edit)-hero/);
  });

  it('keeps hero reveal on transform and opacity only', () => {
    expect(cssSource).toContain('.bl-page-hero.is-inview .bl-page-hero-eyebrow');
    expect(cssSource).toContain('transform: translateY(8px)');
    expect(cssSource).not.toMatch(/\.bl-page-hero[^{]*\{[^}]*filter:/);
    expect(cssSource).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.bl-page-hero-title[\s\S]*transform: none/,
    );
  });
});
