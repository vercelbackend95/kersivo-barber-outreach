import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const difference = read('src/components/landingDifference.astro');
const differenceCss = read('src/styles/components/landingDifference.css');
const starterCss = read('src/styles/components/starter-landing.css');
const homepage = read('src/pages/index.astro');

describe('homepage independent barbershops section: Starter design parity', () => {
  it('keeps the reference starter-shell and a six-card editorial layout', () => {
    expect(difference).toContain('class="starter-shell landing-difference__shell"');
    expect(difference).toContain('BUILT FOR INDEPENDENT BARBERSHOPS');
    expect(difference).toContain('Your barbershop should be the destination. Not the marketplace.');
    expect(difference).toContain('Full KERSIVO brings your website and booking experience together on your own domain.');
    expect(difference).toContain('pillars.map((pillar)');
    expect(difference).toContain('class="landing-difference__card"');
    // Six benefits (two rows of three on desktop) without duplicate icon or title.
    const icons = [...difference.matchAll(/^\s+icon: '([^']+)'/gm)].map((match) => match[1]);
    const titles = [...difference.matchAll(/^\s+title: '([^']+)'/gm)].map((match) => match[1]);
    expect(icons).toHaveLength(6);
    expect(new Set(icons).size).toBe(6);
    expect(titles).toHaveLength(6);
    expect(new Set(titles).size).toBe(6);
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), `public/images/svg/${icon}.svg`))).toBe(true);
    }
    expect(titles).toContain('Build direct client relationships.');
    expect(titles).toContain('Payments on your terms.');
    expect(titles).toContain('No KERSIVO cut of your bookings.');
    expect(difference).not.toMatch(/<h1\b/);
    expect(homepage).toMatch(/<LandingValueCards \/>\s*<LandingDifference \/>\s*<LandingDemoPreview /);
  });

  it('matches Starter shell dimensions, card finish and 3/2/1 breakpoints', () => {
    for (const selector of ['.starter-shell {', '.starter-feature-grid {', '.starter-feature {']) {
      expect(starterCss).toContain(selector);
    }
    expect(differenceCss).toContain('width: min(1180px, calc(100% - 2rem))');
    expect(differenceCss).toContain('width: min(100% - 1.2rem, 1180px)');
    expect(starterCss).toContain('width: min(1180px, calc(100% - 2rem))');
    expect(starterCss).toContain('width: min(100% - 1.2rem, 1180px)');
    expect(differenceCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(differenceCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(differenceCss).toContain('grid-template-columns: 1fr');
    expect(differenceCss).toContain('background: linear-gradient(145deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.018))');
    expect(differenceCss).toContain('border-radius: 1.15rem');
    expect(differenceCss).toContain("-webkit-mask: var(--icon) center / contain no-repeat");
    expect(differenceCss).not.toContain('starter-landing.css');
  });
});
