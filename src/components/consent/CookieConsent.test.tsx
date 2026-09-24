/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  createPreferences,
  writeConsentPreferences,
} from '@/lib/consent';

const applyConsentChoice = vi.fn(async (input: unknown) => input);
const resolvePublicTagIds = vi.fn(() => ({
  gaMeasurementId: 'G-TEST',
  googleAdsId: 'AW-TEST',
}));

vi.mock('@/lib/consent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/consent')>();
  return {
    ...actual,
    applyConsentChoice: (input: unknown, _ids?: unknown) => applyConsentChoice(input),
    resolvePublicTagIds: () => resolvePublicTagIds(),
  };
});

import CookieConsent from './CookieConsent';

function seedDocumentCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/`;
}

function documentCookieNames(): string[] {
  return document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);
}

function clearAllCookies(): void {
  document.cookie.split(';').forEach((part) => {
    const name = part.trim().split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  });
}

function seedOptionalResidue(): void {
  seedDocumentCookie('_ga', 'GA1.1.1');
  seedDocumentCookie('_ga_ABC', 'GS1.1');
  seedDocumentCookie('_gid', 'GA1.2.2');
  seedDocumentCookie('_gcl_au', '1.1.1');
  seedDocumentCookie('_gac_AW', '1.1');
  localStorage.setItem('_gcl_ls', 'ads-linker');
  localStorage.setItem('saas_subscription_paid:ga4:tx1', '1');
  localStorage.setItem('saas_subscription_paid:ads:tx1', '1');
  localStorage.setItem('saas_subscription_paid:legacy', '1');
  localStorage.setItem('setup_deposit_paid:old', '1');
  sessionStorage.setItem('saas_subscription_paid:ga4:tx1', '1');
  sessionStorage.setItem('saas_subscription_paid:ads:tx1', '1');
}

function seedNecessaryAndUnrelated(): void {
  localStorage.setItem('cart:items', 'keep-cart');
  localStorage.setItem('kersivo_shop_cart_v2', 'keep-shop-cart');
  sessionStorage.setItem('feature261-reports-widget-v2', 'keep-session');
  localStorage.setItem('better-auth.session_data', 'keep-auth');
}

function expectNecessarySurvives(): void {
  expect(localStorage.getItem('cart:items')).toBe('keep-cart');
  expect(localStorage.getItem('kersivo_shop_cart_v2')).toBe('keep-shop-cart');
  expect(sessionStorage.getItem('feature261-reports-widget-v2')).toBe('keep-session');
  expect(localStorage.getItem('better-auth.session_data')).toBe('keep-auth');
}

describe('CookieConsent Ads capability UI', () => {
  afterEach(() => {
    cleanup();
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
  });

  beforeEach(() => {
    applyConsentChoice.mockClear();
    resolvePublicTagIds.mockReset();
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('Ads configured: shows Analytics + Advertising measurement + Personalised advertising', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: 'AW-TEST',
    });
    render(<CookieConsent />);

    expect(screen.getByText(/analytics and advertising cookies/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Manage preferences' }));

    expect(screen.getByText('Analytics')).toBeTruthy();
    expect(screen.getByText('Advertising measurement')).toBeTruthy();
    expect(screen.getByText('Personalised advertising')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(applyConsentChoice).toHaveBeenCalled());
    expect(applyConsentChoice.mock.calls[0][0]).toEqual({
      analytics: true,
      advertisingMeasurement: true,
      personalisedAdvertising: true,
    });
  });

  it('Ads absent: hides Ads categories and Accept all grants analytics only', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    render(<CookieConsent />);

    const body = screen.getByText(/analytics cookies to understand site performance/i);
    expect(body.textContent?.toLowerCase()).not.toContain('google ads');
    expect(body.textContent?.toLowerCase()).not.toContain('advertising cookies');
    expect(body.textContent?.toLowerCase()).not.toContain('remarketing');

    fireEvent.click(screen.getByRole('button', { name: 'Manage preferences' }));
    expect(screen.getByText('Analytics')).toBeTruthy();
    expect(screen.queryByText('Advertising measurement')).toBeNull();
    expect(screen.queryByText('Personalised advertising')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(applyConsentChoice).toHaveBeenCalled());
    expect(applyConsentChoice.mock.calls[0][0]).toEqual({
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
    });
  });

  it('Ads absent: Reject optional sends all optional false', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject optional' }));
    await waitFor(() => expect(applyConsentChoice).toHaveBeenCalled());
    expect(applyConsentChoice.mock.calls[0][0]).toEqual({
      analytics: false,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
    });
  });

  it('Ads absent: Save preferences cannot produce Ads=true', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage preferences' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Analytics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save choices' }));
    await waitFor(() => expect(applyConsentChoice).toHaveBeenCalled());
    expect(applyConsentChoice.mock.calls[0][0]).toEqual({
      analytics: true,
      advertisingMeasurement: false,
      personalisedAdvertising: false,
    });
  });
});

describe('CookieConsent automatic optional storage retirement', () => {
  afterEach(() => {
    cleanup();
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
  });

  beforeEach(() => {
    applyConsentChoice.mockClear();
    resolvePublicTagIds.mockReset();
    clearAllCookies();
    localStorage.clear();
    sessionStorage.clear();
    window.gtag = vi.fn();
  });

  it('A: old v2 + stale optional storage + Ads absent + no click clears all optional residue', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    seedDocumentCookie(
      CONSENT_COOKIE_NAME,
      JSON.stringify({
        version: 2,
        necessary: true,
        analytics: true,
        advertisingMeasurement: true,
        personalisedAdvertising: true,
        timestamp: new Date().toISOString(),
      }),
    );
    seedOptionalResidue();
    seedNecessaryAndUnrelated();

    render(<CookieConsent />);

    await waitFor(() => {
      expect(documentCookieNames()).not.toContain('_ga');
      expect(documentCookieNames()).not.toContain('_gcl_au');
    });

    expect(documentCookieNames()).not.toContain('_ga_ABC');
    expect(documentCookieNames()).not.toContain('_gid');
    expect(documentCookieNames()).not.toContain('_gac_AW');
    expect(localStorage.getItem('_gcl_ls')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(localStorage.getItem('saas_subscription_paid:legacy')).toBeNull();
    expect(localStorage.getItem('setup_deposit_paid:old')).toBeNull();
    expect(sessionStorage.getItem('saas_subscription_paid:ga4:tx1')).toBeNull();
    expect(sessionStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();

    // Consent cookie itself survives (still invalid v2 for UI).
    expect(documentCookieNames()).toContain(CONSENT_COOKIE_NAME);
    expect(screen.getByText('Your privacy choices')).toBeTruthy();
    expect(applyConsentChoice).not.toHaveBeenCalled();
    expectNecessarySurvives();
  });

  it('B: no consent cookie + stale optional storage clears on mount', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    seedOptionalResidue();
    seedNecessaryAndUnrelated();

    render(<CookieConsent />);

    await waitFor(() => {
      expect(documentCookieNames()).not.toContain('_gcl_au');
      expect(localStorage.getItem('_gcl_ls')).toBeNull();
    });
    expect(documentCookieNames()).not.toContain('_ga');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(screen.getByText('Your privacy choices')).toBeTruthy();
    expectNecessarySurvives();
  });

  it('C: valid v3 analytics-only + Ads absent preserves GA and clears Ads residue', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    writeConsentPreferences(
      createPreferences({
        analytics: true,
        advertisingMeasurement: false,
        personalisedAdvertising: false,
      }),
    );
    seedOptionalResidue();
    seedNecessaryAndUnrelated();

    render(<CookieConsent />);

    await waitFor(() => {
      expect(documentCookieNames()).not.toContain('_gcl_au');
      expect(localStorage.getItem('_gcl_ls')).toBeNull();
    });

    expect(documentCookieNames()).toContain('_ga');
    expect(documentCookieNames()).toContain('_ga_ABC');
    expect(documentCookieNames()).toContain('_gid');
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expect(sessionStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expect(documentCookieNames()).not.toContain('_gac_AW');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(sessionStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expectNecessarySurvives();
  });

  it('D: valid v3 all-granted historical + Ads absent clears Ads, keeps GA', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    writeConsentPreferences(
      createPreferences({
        analytics: true,
        advertisingMeasurement: true,
        personalisedAdvertising: true,
      }),
    );
    expect(CONSENT_VERSION).toBe(3);
    seedOptionalResidue();
    seedNecessaryAndUnrelated();

    render(<CookieConsent />);

    await waitFor(() => {
      expect(documentCookieNames()).not.toContain('_gcl_au');
      expect(localStorage.getItem('_gcl_ls')).toBeNull();
    });

    expect(documentCookieNames()).toContain('_ga');
    expect(documentCookieNames()).toContain('_gid');
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBeNull();
    expect(documentCookieNames()).not.toContain('_gac_AW');
    expectNecessarySurvives();
  });

  it('E: valid v3 Ads-capable + Ads ID present does not retire Ads storage', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: 'AW-TEST',
    });
    writeConsentPreferences(
      createPreferences({
        analytics: true,
        advertisingMeasurement: true,
        personalisedAdvertising: true,
      }),
    );
    seedOptionalResidue();
    seedNecessaryAndUnrelated();

    render(<CookieConsent />);

    // Allow effects to flush; retirement must not run.
    await waitFor(() => {
      expect(document.querySelector('[data-ads-enabled="1"]')).toBeTruthy();
    });

    expect(documentCookieNames()).toContain('_ga');
    expect(documentCookieNames()).toContain('_gcl_au');
    expect(documentCookieNames()).toContain('_gac_AW');
    expect(localStorage.getItem('_gcl_ls')).toBe('ads-linker');
    expect(localStorage.getItem('saas_subscription_paid:ads:tx1')).toBe('1');
    expect(localStorage.getItem('saas_subscription_paid:ga4:tx1')).toBe('1');
    expectNecessarySurvives();
  });

  it('G: mount cleanup does not call gtag or applyConsentChoice', async () => {
    resolvePublicTagIds.mockReturnValue({
      gaMeasurementId: 'G-TEST',
      googleAdsId: '',
    });
    seedOptionalResidue();
    const gtag = window.gtag as ReturnType<typeof vi.fn>;

    render(<CookieConsent />);

    await waitFor(() => {
      expect(documentCookieNames()).not.toContain('_gcl_au');
    });

    expect(gtag).not.toHaveBeenCalled();
    expect(applyConsentChoice).not.toHaveBeenCalled();
  });
});
