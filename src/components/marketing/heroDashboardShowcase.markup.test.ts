import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const showcaseSource = read('src/components/marketing/HeroDashboardShowcase.astro');
const showcaseCss = read('src/styles/components/hero-dashboard-showcase.css');
const bindingSource = read('src/lib/marketing/heroDashboardShowcase.ts');
const freshaHeroSource = read('src/components/freshaAlternative/FreshaHero.astro');
const freshaCss = read('src/styles/components/fresha-alternative.css');
const homepageHeroSource = read('src/components/homepage/HomepageHero.astro');
const homepageHeroCss = read('src/styles/components/homepage-hero.css');
const adminPage = read('src/pages/demo/admin.astro');

const frameMarkup = showcaseSource.slice(showcaseSource.indexOf('<iframe'), showcaseSource.indexOf('</iframe>'));

describe('shared hero dashboard showcase: one implementation for every hero', () => {
  it('is rendered by both the homepage and the Fresha Alternative hero', () => {
    for (const hero of [homepageHeroSource, freshaHeroSource]) {
      expect(hero).toContain("import HeroDashboardShowcase from '@/components/marketing/HeroDashboardShowcase.astro';");
      expect(hero.split('<HeroDashboardShowcase />')).toHaveLength(2);
    }
  });

  it('keeps no second copy of the iframe, loader or showcase styles in either hero', () => {
    for (const hero of [homepageHeroSource, freshaHeroSource]) {
      expect(hero).not.toMatch(/<iframe|<script|data-deferred-demo-frame|mountDeferredDemoFrame/);
      expect(hero).not.toMatch(/announceHeroShowcaseVisibleWhenSeen|HERO_SHOWCASE_READY_MESSAGE_TYPE|demo\/admin/);
    }
    for (const css of [freshaCss, homepageHeroCss]) {
      expect(css).not.toMatch(/product-(?:shell|glow|viewport|frame|caption)|data-frame-state|hero-showcase/);
    }
  });

  it('binds through the single shared module on first load and on every soft swap', () => {
    expect(showcaseSource).toMatch(
      /<script>\s*import \{ bindHeroDashboardShowcase \} from '@\/lib\/marketing\/heroDashboardShowcase';\s*bindHeroDashboardShowcase\(\);\s*document\.addEventListener\('astro:page-load', \(\) => bindHeroDashboardShowcase\(\)\);\s*<\/script>/,
    );
    expect(bindingSource).toMatch(
      /mountDeferredDemoFrame\(viewport, win, \{ readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE \}\);/,
    );
    expect(bindingSource).toContain('announceHeroShowcaseVisibleWhenSeen(viewport, productFrame, win)');
    expect(bindingSource).toMatch(/doc\.addEventListener\('astro:before-swap', [^\n]+\{ once: true \}\);/);
  });

  it('shows the real dashboard route with its caption and accessible title', () => {
    expect(frameMarkup).toContain('data-deferred-src="/demo/admin?embed=hero&section=bookings_dashboard"');
    expect(frameMarkup).toContain('title="Interactive KERSIVO owner dashboard demo"');
    expect(showcaseSource).toContain(
      'This is the real KERSIVO demo dashboard. Click around — bookings, team, reports and more.',
    );
    expect(showcaseSource).toMatch(/<div class="hero-showcase__glow" aria-hidden="true"><\/div>/);
  });
});

describe('hero dashboard progressive loading', () => {
  it('defers the dashboard iframe inside the reserved viewport', () => {
    expect(showcaseSource).toContain('data-deferred-demo-frame');
    expect(frameMarkup).not.toMatch(/\ssrc=/);
    expect(frameMarkup).not.toContain('sandbox');
  });

  it('uses the plain hero background as the loading state, with no dashboard poster', () => {
    const viewportMarkup = showcaseSource.slice(
      showcaseSource.indexOf('data-deferred-demo-frame'),
      showcaseSource.indexOf('<picture class="hero-showcase__still">'),
    );
    expect(viewportMarkup).toContain('</noscript>');
    expect(viewportMarkup).not.toMatch(/<picture|<img|<source|<svg|skeleton|spinner|Loading/i);
    expect(showcaseSource).not.toMatch(/poster|dashboard-showcase-v2|rel="preload"/i);
    expect(viewportMarkup).not.toContain('fetchpriority');
    expect(showcaseCss).not.toMatch(/product-poster|object-fit: none/);
    expect(existsSync(join(process.cwd(), 'public/images/fresha-alternative'))).toBe(false);
    expect(showcaseSource).toMatch(
      /<noscript>\s*<iframe\s+src="\/demo\/admin\?embed=hero&section=bookings_dashboard"/,
    );
  });

  const productRules = () =>
    showcaseCss.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]*\.hero-showcase(?:__viewport|__frame)?[\s:.[>{][^{}]*\{[^}]*\}/g) ?? [];
  const ruleFor = (selector: RegExp) => productRules().filter((rule) => selector.test(rule.split('{')[0]));

  it('reserves the final product viewport geometry before the dashboard appears', () => {
    const viewport = ruleFor(/^\s*\.hero-showcase__viewport\s*$/);
    for (const rule of viewport.filter((r) => /height:/.test(r))) {
      expect(rule).toMatch(/[^-]height: clamp\([^)]+\);/);
      expect(rule).toMatch(/max-height: [^;]+;/);
    }
    expect(viewport[0]).toMatch(/height: clamp\(38rem, 56vw, 51rem\);/);
    expect(viewport[0]).toMatch(/max-height: clamp\(38rem, 56vw, 51rem\);/);
    expect(viewport[0]).toMatch(/contain: layout paint size;/);
    expect(viewport[0]).toMatch(/background: #030303;/);
    expect(viewport[0]).toMatch(/border-radius: clamp\(0\.8rem, 1\.25vw, 1\.05rem\);/);
    expect(viewport[0]).toMatch(/box-shadow:/);
    expect(showcaseCss).toMatch(/\.hero-showcase__viewport iframe \{[^}]*position: absolute;[^}]*inset: 0;[^}]*background: #030303;/);
    expect(showcaseCss).toMatch(/--hero-showcase-max-width: 91\.1rem;\s*width: min\(94vw, var\(--hero-showcase-max-width\)\);/);
  });

  it('keeps the live frame hidden and inert until the verified ready swap', () => {
    expect(showcaseCss).toMatch(
      /\.hero-showcase__viewport \.hero-showcase__frame \{\s*opacity: 0;\s*pointer-events: none;\s*\}/,
    );
  });

  it('reveals the live frame atomically: visible and interactive together', () => {
    const readyFrame = ruleFor(/^\s*\.hero-showcase__viewport\[data-frame-state='ready'\] \.hero-showcase__frame\s*$/);
    expect(readyFrame).toHaveLength(1);
    expect(readyFrame[0]).toMatch(/\{\s*opacity: 1;\s*pointer-events: auto;\s*\}$/);
  });

  const REVEAL = 'opacity 800ms cubic-bezier(0.25, 0.1, 0.25, 1)';

  it('keeps the whole product (chrome, frame and glow) transparent but laid out until ready', () => {
    const gate = showcaseCss.slice(showcaseCss.indexOf('@media (scripting: enabled) {'));
    expect(gate).toMatch(
      /^@media \(scripting: enabled\) \{\s*\.hero-showcase__viewport:not\(\[data-frame-state='ready'\]\) \{\s*opacity: 0;\s*\}/,
    );
    expect(gate).toMatch(
      /\.hero-showcase:has\(> \.hero-showcase__viewport:not\(\[data-frame-state='ready'\]\)\)\s*> \.hero-showcase__glow \{\s*opacity: 0;\s*\}/,
    );
    for (const rule of ruleFor(/hero-showcase__viewport/)) expect(rule).not.toMatch(/display: none|visibility: hidden/);
    const desktopCss = showcaseCss.slice(0, showcaseCss.indexOf('@media (max-width: 48rem) {'));
    expect(desktopCss).not.toMatch(/\.hero-showcase__viewport[^{]*\{[^}]*display: none/);
  });

  it('fades the finished product in as one object, opacity only, only once ready', () => {
    const motion = showcaseCss.slice(
      showcaseCss.indexOf('@media (scripting: enabled) and (prefers-reduced-motion: no-preference) {'),
    );
    expect(motion).toMatch(
      /^@media \(scripting: enabled\) and \(prefers-reduced-motion: no-preference\) \{\s*\.hero-showcase__viewport\[data-frame-state='ready'\] \{\s*transition: opacity 800ms cubic-bezier\(0\.25, 0\.1, 0\.25, 1\);\s*\}\s*\.hero-showcase:has\(> \.hero-showcase__viewport\[data-frame-state='ready'\]\)\s*> \.hero-showcase__glow \{\s*transition: opacity 800ms cubic-bezier\(0\.25, 0\.1, 0\.25, 1\);\s*\}\s*\}/,
    );
    expect(showcaseCss.split('transition:')).toHaveLength(3);
    expect(bindingSource).not.toMatch(/addEventListener\('load'|setTimeout|onload/);
  });

  it('shows the product immediately for reduced motion', () => {
    const withoutMotionBlock = showcaseCss.replace(
      /@media \(scripting: enabled\) and \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/,
      '',
    );
    expect(withoutMotionBlock).not.toContain(REVEAL);
    expect(withoutMotionBlock).not.toContain('transition');
  });

  it('never moves, scales or animates the product dashboard beyond its opacity reveal', () => {
    const css = showcaseCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/animation|scale\(|zoom|translate|rotate|will-change|@keyframes/);
    expect(css).not.toMatch(/transform:/);
    const filters = css.match(/filter: [^;]+;/g) ?? [];
    expect(filters).toEqual(['filter: blur(24px);']);
    expect(css).toMatch(/\.hero-showcase__glow \{[^}]*filter: blur\(24px\);/);
  });

  it('keeps the showcase shell at full opacity, untransformed and clickable', () => {
    const shell = ruleFor(/^\s*\.hero-showcase\s*$/);
    expect(shell.length).toBeGreaterThan(0);
    for (const rule of shell) expect(rule).not.toMatch(/opacity|transition|transform|pointer-events: none/);
  });

  it('lets wheel scrolling over the hero iframe chain natively to the landing page', () => {
    expect(existsSync(join(process.cwd(), 'src/lib/admin/heroShowcaseWheel.ts'))).toBe(false);
    for (const source of [adminPage, bindingSource]) {
      expect(source).not.toMatch(/['"]wheel['"]|scrollBy|hero-showcase-wheel/);
    }
    expect(adminPage).toMatch(/body\.admin-hero-embed-body \.admin-vtl-scroll \{\s*overflow-y: hidden !important;\s*\}/);
    expect(adminPage).toMatch(/body\.admin-hero-embed-body \*\s*\{\s*overscroll-behavior: auto !important;/);
  });
});
