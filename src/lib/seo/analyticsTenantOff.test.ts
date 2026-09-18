import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function readPage(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

describe('KERSIVO marketing analytics gating (DPA hardening)', () => {
  it('MainLayout defaults analytics on and gates GoogleAnalytics', () => {
    const src = readPage('../../layouts/MainLayout.astro');
    expect(src).toContain('enableAnalytics = true');
    expect(src).toContain('enableAnalytics ? <GoogleAnalytics');
  });

  it('disables analytics on live tenant book and shop surfaces', () => {
    const pages = [
      '../../pages/book/[shopId].astro',
      '../../pages/book/[shopId]/success.astro',
      '../../pages/shop/[shopId].astro',
      '../../pages/shop/[shopId]/[productId].astro',
      '../../pages/shop/[shopId]/success.astro',
      '../../pages/shop/[shopId]/cancelled.astro',
    ];
    for (const page of pages) {
      expect(readPage(page), page).toContain('enableAnalytics={false}');
    }
  });

  it('disables analytics on authenticated admin / preview product surfaces', () => {
    const pages = [
      '../../pages/admin.astro',
      '../../pages/admin/onboarding.astro',
      '../../pages/admin/launch.astro',
      '../../pages/admin/client-onboarding.astro',
      '../../pages/admin/retail-onboarding.astro',
      '../../pages/admin/site-preview.astro',
      '../../pages/admin/test-shop.astro',
      '../../pages/admin/test-shop/[id].astro',
      '../../pages/admin/test-book.astro',
      '../../pages/admin/invite.astro',
      '../../pages/preview/dashboard.astro',
      '../../pages/preview/onboarding.astro',
    ];
    for (const page of pages) {
      expect(readPage(page), page).toContain('enableAnalytics={false}');
    }
  });

  it('keeps marketing privacy page on MainLayout analytics default (not forced off)', () => {
    const src = readPage('../../pages/privacy.astro');
    expect(src).toContain('MainLayout');
    expect(src).not.toContain('enableAnalytics={false}');
  });

  it('keeps homepage LandingLayout mounting GoogleAnalytics unconditionally', () => {
    const landing = readPage('../../layouts/LandingLayout.astro');
    const home = readPage('../../pages/index.astro');
    expect(home).toContain('LandingLayout');
    expect(landing).toContain('<GoogleAnalytics />');
    expect(landing).not.toContain('enableAnalytics');
  });
});
