import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const banner = readFileSync(new URL('../../components/demo/DemoBanner.astro', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../../components/shop/storefront/StorefrontHeader.astro', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../../components/demo/DemoFooter.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const astroConfig = readFileSync(new URL('../../../astro.config.mjs', import.meta.url), 'utf8');
const checkout = readFileSync(new URL('../../components/demo/DemoCheckout.tsx', import.meta.url), 'utf8');
const booking = readFileSync(new URL('../../pages/demo/book.astro', import.meta.url), 'utf8');

describe('BLACKLINE route transition layout', () => {
  it('enables Astro ClientRouter in BLACKLINE without experimental flags and without a second coordinator', () => {
    expect(layout).toContain("from 'astro:transitions'");
    expect(layout).toContain('ClientRouter');
    expect(layout).toContain('fallback="swap"');
    expect(layout).toContain('transition:animate="none"');
    expect(astroConfig).not.toMatch(/experimental\s*:/);
    expect(astroConfig).not.toContain('viewTransitions');
    expect(layout).toContain("from '@/lib/demo/routeTransition'");
    expect(layout).not.toContain("from '@/lib/navigation/routeTransition'");
  });

  it('persists chrome and the bag island without keying the layout by pathname', () => {
    expect(banner).toContain("transition:persist={isAdmin ? undefined : 'bl-banner'}");
    expect(nav).toContain("transition:persist={persistKey}");
    expect(nav).toContain("themeId === 'blackline' ? 'bl-header'");
    expect(footer).toContain('transition:persist="bl-footer"');
    expect(layout).toContain('transition:persist="bl-bag"');
    expect(layout).toContain('transition:persist="bl-veil"');
    expect(layout).not.toContain('key={Astro.url.pathname}');
    expect(layout).not.toContain('key={currentPath}');
    expect(booking).not.toContain('transition:persist');
  });

  it('paints a scoped carbon fallback and keeps the veil off the document chrome', () => {
    expect(layout).toContain("html[data-theme='blackline']");
    expect(layout).toContain('background: #0b0c0e');
    expect(css).toContain("html[data-theme='blackline']");
    expect(css).toContain('background: #0b0c0e');
    expect(css).toContain('.bl-route-veil');
    expect(css).toContain('--bl-duration-route-cover: 140ms');
    expect(css).toContain('--bl-duration-route-reveal: 220ms');
    expect(css).toContain('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(layout).toContain('data-bl-route-phase="idle"');
    expect(layout).toContain('aria-hidden="true"');
    expect(layout).toContain('class="bl-main"');
  });

  it('forces a document reload when leaving the demo and uses ClientRouter for checkout confirmation', () => {
    expect(banner).toContain('data-astro-reload');
    expect(banner).toContain('href="/"');
    expect(checkout).toContain('navigateDemoPath');
    expect(checkout).toContain("'/demo/shop/confirmation'");
    expect(checkout).not.toContain('window.location.assign');
  });
});
