import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...segments: string[]) => readFileSync(join(here, '../..', ...segments), 'utf8');

const marketingDir = ['components', 'navigation', 'marketing'];
const navbar = read(...marketingDir, 'MarketingNavbar.astro');
const mobile = read(...marketingDir, 'MarketingMobileNav.astro');
const panel = read(...marketingDir, 'MarketingNavPanel.astro');
const link = read(...marketingDir, 'MarketingNavLink.astro');
const actions = read(...marketingDir, 'MarketingNavActions.astro');
const client = read(...marketingDir, 'MarketingNavbarClient.astro');
const allMarkup = [navbar, mobile, panel, link, actions];
const landingLayout = read('layouts', 'LandingLayout.astro');
const mainLayout = read('layouts', 'MainLayout.astro');
const css = read('styles', 'components', 'marketing-navbar.css');

describe('marketing navbar markup', () => {
  it('drives desktop and mobile from the same resolved config', () => {
    expect(navbar).toContain('const groups = buildMarketingNavigation();');
    expect(navbar).toMatch(/<MarketingMobileNav[\s\S]*groups=\{groups\}/);
    expect(navbar).toContain('<MarketingNavPanel group={group}');
    expect(panel).toContain('<MarketingNavLink');
    expect(mobile).toContain('<MarketingNavLink');
    expect(navbar).toContain('MARKETING_NAV_DIRECT_LINKS.map');
    expect(navbar).toContain('directLinks={MARKETING_NAV_DIRECT_LINKS}');
    for (const source of [navbar, mobile, panel]) expect(source).not.toMatch(/href="\/(booksy|fresha|barber-software)/);
  });

  it('renders crawlable anchors without menu roles or nofollow', () => {
    for (const source of allMarkup) {
      expect(source).not.toContain('role="menu"');
      expect(source).not.toContain('role="menuitem"');
      expect(source).not.toContain('nofollow');
    }
    expect(link).toMatch(/<a\s[\s\S]*href=\{item\.href\}/);
    expect(link).toContain("aria-current={current ? 'page' : undefined}");
  });

  it('uses disclosure semantics for desktop triggers and mobile accordions', () => {
    expect(navbar).toContain('aria-expanded="false"');
    expect(navbar).toContain('aria-controls={`mnav-panel-${group.id}`}');
    expect(navbar).toContain('aria-controls="mnav-hub"');
    expect(navbar).toContain('<nav class="mnav__desktop" aria-label="Main">');
    expect(mobile).toContain('aria-controls={`${id}-${group.id}`}');
    expect(mobile).toMatch(/class="mnav-hub"[^>]*hidden inert/);
    expect(panel).toMatch(/data-mnav-panel[^>]*hidden/);
  });

  it('persists across marketing swaps and boots the controller on page-load', () => {
    expect(navbar).toContain('transition:persist="ks-nav-marketing"');
    expect(client).toContain("import { initMarketingNav } from '@/lib/nav/marketingNavController'");
    expect(client).toContain('astro:page-load');
  });

  it('keeps the mobile hub viewport-safe', () => {
    expect(css).toContain('100dvh');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('html.mnav-locked');
    expect(css).toContain('prefers-reduced-motion');
  });
});

describe('navbar boundaries', () => {
  it('uses the marketing navbar only in LandingLayout', () => {
    expect(landingLayout).toContain('<MarketingNavbar />');
    expect(landingLayout).not.toContain('Navbar17');
    expect(landingLayout).not.toContain('navbarVariant');
  });

  it('keeps shop and test-shop pages on Navbar17', () => {
    expect(mainLayout).toContain("import Navbar17 from '@/components/navbar17.astro'");
    expect(mainLayout).toContain('<Navbar17 variant={navbarVariant} />');
    expect(mainLayout).not.toContain('MarketingNavbar');
  });

  it('SEO pages rely on the layout navbar instead of a variant', () => {
    for (const page of ['booksy-alternative', 'fresha-alternative', 'barber-software-cost-calculator']) {
      const source = read('pages', page, 'index.astro');
      expect(source, page).toContain('LandingLayout');
      expect(source, page).not.toContain('navbarVariant');
    }
  });
});
