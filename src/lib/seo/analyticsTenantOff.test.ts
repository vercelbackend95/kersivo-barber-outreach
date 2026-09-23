import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function readPage(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

/**
 * Structural contract: tenant public surfaces must not mount the KERSIVO
 * marketing analytics bootstrap (GoogleAnalytics + CookieConsent → gtag).
 * Prefer layout gates over pathname regex.
 */
describe('KERSIVO marketing analytics gating (DPA hardening)', () => {
  it('MainLayout gates GoogleAnalytics, CookieConsent, and InitDataTrack on enableAnalytics', () => {
    const src = readPage('../../layouts/MainLayout.astro');
    expect(src).toContain('enableAnalytics = true');
    expect(src).toContain('enableAnalytics ? <GoogleAnalytics');
    expect(src).toMatch(
      /enableAnalytics\s*\?\s*\([\s\S]*?CookieConsentMount[\s\S]*?\)\s*:\s*null/,
    );
    expect(src).toContain('enableAnalytics ? <InitDataTrackScript');
  });

  it('MinimalLayout couples CookieConsent to enableAnalytics (hard-off invariant)', () => {
    const src = readPage('../../layouts/MinimalLayout.astro');
    expect(src).toContain('enableAnalytics ? <GoogleAnalytics');
    expect(src).toContain('mountCookieConsent = showCookieConsent && enableAnalytics');
    expect(src).toContain('mountCookieConsent ? (');
    expect(src).toContain('<CookieConsentMount />');
    expect(src).not.toMatch(
      /\{showCookieConsent \? \(\s*<div transition:persist="ks-cookie">/,
    );
  });

  it('disables analytics bootstrap on live tenant shop surfaces', () => {
    const pages = [
      '../../pages/shop/[shopId].astro',
      '../../pages/shop/[shopId]/[productId].astro',
      '../../pages/shop/[shopId]/success.astro',
      '../../pages/shop/[shopId]/cancelled.astro',
    ];
    for (const page of pages) {
      expect(readPage(page), page).toContain('enableAnalytics={false}');
    }
  });

  it('tenant shop success/cancelled inherit consent hard-off without showCookieConsent=false', () => {
    const success = readPage('../../pages/shop/[shopId]/success.astro');
    const cancelled = readPage('../../pages/shop/[shopId]/cancelled.astro');
    expect(success).toContain('enableAnalytics={false}');
    expect(cancelled).toContain('enableAnalytics={false}');
    // Layout enforces consent off when analytics is off — callers need not pass both.
    expect(success).not.toContain('showCookieConsent={false}');
    expect(cancelled).not.toContain('showCookieConsent={false}');
    const layout = readPage('../../layouts/MinimalLayout.astro');
    expect(layout).toContain('mountCookieConsent = showCookieConsent && enableAnalytics');
  });

  it('disables analytics + consent on live tenant book surfaces', () => {
    const pages = [
      '../../pages/book/[shopId].astro',
      '../../pages/book/[shopId]/success.astro',
    ];
    for (const page of pages) {
      const src = readPage(page);
      expect(src, page).toContain('enableAnalytics={false}');
      expect(src, page).toContain('showCookieConsent={false}');
    }
  });

  it('disables analytics + consent on booking lifecycle surfaces', () => {
    const pages = [
      '../../pages/book/confirm.astro',
      '../../pages/book/cancel.astro',
      '../../pages/book/reschedule.astro',
    ];
    for (const page of pages) {
      const src = readPage(page);
      expect(src, page).toContain('enableAnalytics={false}');
      expect(src, page).toContain('showCookieConsent={false}');
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

  it('keeps corporate retail demo shop on MainLayout analytics default', () => {
    const shop = readPage('../../pages/shop.astro');
    const demoPdp = readPage('../../pages/shop/demo/[id].astro');
    expect(shop).toContain('MainLayout');
    expect(shop).not.toContain('enableAnalytics={false}');
    expect(demoPdp).toContain('MainLayout');
    expect(demoPdp).not.toContain('enableAnalytics={false}');
  });

  it('keeps homepage LandingLayout mounting GoogleAnalytics and CookieConsent', () => {
    const landing = readPage('../../layouts/LandingLayout.astro');
    const home = readPage('../../pages/index.astro');
    expect(home).toContain('LandingLayout');
    expect(landing).toContain('<GoogleAnalytics />');
    expect(landing).toContain('<CookieConsentMount />');
    expect(landing).not.toContain('enableAnalytics');
  });

  it('CookieConsent acceptance path still loads tags via applyConsentChoice (corporate only)', () => {
    const consent = readPage('../../components/consent/CookieConsent.tsx');
    const index = readPage('../../lib/consent/index.ts');
    const tagLoader = readPage('../../lib/consent/tagLoader.ts');
    expect(consent).toContain('applyConsentChoice');
    expect(index).toContain('syncTagsForConsent');
    expect(tagLoader).toContain('googletagmanager.com/gtag/js');
  });
});
