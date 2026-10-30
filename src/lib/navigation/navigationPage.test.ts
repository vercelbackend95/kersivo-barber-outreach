import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainLayout = readFileSync(new URL('../../layouts/MainLayout.astro', import.meta.url), 'utf8');
const landingLayout = readFileSync(new URL('../../layouts/LandingLayout.astro', import.meta.url), 'utf8');
const minimalLayout = readFileSync(new URL('../../layouts/MinimalLayout.astro', import.meta.url), 'utf8');
const demoLayout = readFileSync(new URL('../../layouts/DemoLayout.astro', import.meta.url), 'utf8');
const adminPanel = readFileSync(new URL('../../components/admin/AdminPanel.tsx', import.meta.url), 'utf8');
const astroConfig = readFileSync(new URL('../../../astro.config.mjs', import.meta.url), 'utf8');
const navbar = readFileSync(new URL('../../components/navbar17.astro', import.meta.url), 'utf8');
const motion = readFileSync(new URL('../../styles/motion.css', import.meta.url), 'utf8');

describe('KERSIVO route transition families', () => {
  it('opts every layout family into ClientRouter (GA4 page_view per navigation: see GoogleAnalytics.astro)', () => {
    expect(astroConfig).not.toMatch(/experimental\s*:/);
    expect(astroConfig).not.toContain('viewTransitions');
    // Marketing: browsers without view transitions keep normal page loads rather than a JS swap.
    expect(landingLayout).toContain('<ClientRouter fallback="none" />');
    expect(mainLayout).toContain('ClientRouter');
    expect(minimalLayout).toContain('ClientRouter');
    expect(mainLayout).toContain('fallback="swap"');
    expect(mainLayout).toContain("data-app=\"marketing\"");
    expect(minimalLayout).toContain('data-app={app}');
    expect(demoLayout).toContain("data-theme=\"blackline\"");
  });

  it('persists chrome per family and forces reloads on family exits', () => {
    expect(navbar).toContain(
      "transition:persist={`ks-nav-${variant}-${showCart ? 'cart' : 'nocart'}`}",
    );
    expect(navbar).toContain('data-astro-reload');
    expect(mainLayout).toContain('transition:persist="ks-cookie"');
    expect(mainLayout).toContain('transition:persist="ks-cart"');
    expect(landingLayout).not.toContain('key={Astro.url.pathname}');
    expect(minimalLayout).toContain('background: #030303');
    expect(mainLayout).toContain('background: #0b0d10');
  });

  it('crossfades full page loads only, and only when motion is allowed', () => {
    const routeCss = readFileSync(new URL('../../styles/components/route-transition.css', import.meta.url), 'utf8');
    expect(motion).toMatch(/@view-transition \{\s*navigation: auto;\s*\}/);
    expect(motion).toMatch(/prefers-reduced-motion: reduce\) \{\s*@view-transition \{\s*navigation: none;/);
    expect(routeCss).toContain('html[data-astro-transition]::view-transition-old(root)');
    expect(routeCss).not.toMatch(/html\[data-app='marketing'\]::view-transition/);
  });

  it('keeps the progress bar and veil fixed to the viewport, the veil below the navbar', () => {
    const routeCss = readFileSync(new URL('../../styles/components/route-transition.css', import.meta.url), 'utf8');
    expect(routeCss).toMatch(/\.ks-route-pending \{\s*position: fixed;/);
    expect(routeCss).toMatch(/\.ks-route-veil \{\s*position: fixed;\s*inset: var\(--nav-sticky-offset, 0px\) 0 0;/);
  });

  it('preloads only the variable Inter and Bebas Neue on marketing pages', () => {
    const fonts = readFileSync(new URL('../../styles/fonts-landing.css', import.meta.url), 'utf8');
    expect(landingLayout).toContain('/fonts/inter-latin-variable.woff2');
    expect(landingLayout).toContain('/fonts/bebas-neue-latin-400-normal.woff2');
    expect(landingLayout).not.toContain('antonio');
    expect(mainLayout).not.toContain('antonio');
    expect(fonts).not.toContain('Antonio');
    expect(fonts).toMatch(/font-weight: 100 900;/);
    expect(landingLayout).toContain('data-astro-transition-persist="ks-font-faces"');
    expect(landingLayout).not.toContain("import '@/styles/fonts-landing.css'");
  });

  it('keeps BLACKLINE on its own coordinator and shared motion tokens', () => {
    expect(demoLayout).toContain("from '@/lib/demo/routeTransition'");
    expect(demoLayout).not.toContain("from '@/lib/navigation/routeTransition'");
    expect(demoLayout).toContain("import '@/styles/motion.css'");
    expect(motion).toContain('--motion-duration-dashboard');
    expect(motion).toContain('--route-surface');
    expect(motion).not.toContain("from '@/styles/global.css'");
  });

  it('uses dashboard SPA history and does not remount shop on tab change', () => {
    const sectionChange = adminPanel.slice(
      adminPanel.indexOf('const handleSectionChange'),
      adminPanel.indexOf('pendingTimeoutRef.current = window.setTimeout', adminPanel.indexOf('const handleSectionChange')),
    );
    expect(sectionChange).toContain('history.pushState');
    expect(sectionChange).not.toContain('history.replaceState');
    // replaceState is reserved for consuming the one-shot ?upgrade= deep-link param.
    expect(adminPanel.match(/history\.replaceState/g)).toHaveLength(1);
    const replaceBlock = adminPanel.slice(adminPanel.indexOf('upgradeParamHandledRef.current = true'), adminPanel.indexOf('history.replaceState'));
    expect(replaceBlock).toContain('params.delete(ADMIN_UPGRADE_QUERY_PARAM)');
    expect(adminPanel).toMatch(/<ShopAdminPanel\s+key="shop"/);
    expect(adminPanel).not.toContain('key={activeSection}');
    expect(adminPanel).toContain('ADMIN_SESSION_EXPIRED_EVENT');
    expect(adminPanel).not.toContain('Checking session…');
  });
});
