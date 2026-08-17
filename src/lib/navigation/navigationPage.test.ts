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
  it('opts each layout family into ClientRouter without experimental flags', () => {
    expect(astroConfig).not.toMatch(/experimental\s*:/);
    expect(astroConfig).not.toContain('viewTransitions');
    expect(landingLayout).toContain('ClientRouter');
    expect(mainLayout).toContain('ClientRouter');
    expect(minimalLayout).toContain('ClientRouter');
    expect(landingLayout).toContain('fallback="swap"');
    expect(mainLayout).toContain("data-app=\"marketing\"");
    expect(minimalLayout).toContain('data-app={app}');
    expect(demoLayout).toContain("data-theme=\"blackline\"");
  });

  it('persists chrome per family and forces reloads on family exits', () => {
    expect(navbar).toContain('transition:persist={`ks-nav-${variant}`}');
    expect(navbar).toContain('data-astro-reload');
    expect(mainLayout).toContain('transition:persist="ks-cookie"');
    expect(mainLayout).toContain('transition:persist="ks-cart"');
    expect(landingLayout).not.toContain('key={Astro.url.pathname}');
    expect(minimalLayout).toContain('background: #030303');
    expect(mainLayout).toContain('background: #0b0d10');
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
    expect(adminPanel).toContain('history.pushState');
    expect(adminPanel).not.toContain('history.replaceState');
    expect(adminPanel).toContain('<ShopAdminPanel key="shop"');
    expect(adminPanel).not.toContain('key={activeSection}');
    expect(adminPanel).toContain('ADMIN_SESSION_EXPIRED_EVENT');
    expect(adminPanel).not.toContain('Checking session…');
  });
});
