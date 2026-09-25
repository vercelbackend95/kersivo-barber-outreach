import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildSaasSubscriptionStripeMetadata } from '@/lib/setup/saasSubscription';
import { buildSetupDepositStripeMetadata } from '@/lib/setup/plans';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const ATTRIBUTION_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'ga_client_id',
] as const;

describe('Phase 3B — server-side checkout attribution removal', () => {
  it('LaunchWizard no longer collects or sends checkout attribution', () => {
    const wizard = readRepoFile('../../components/admin/launch/LaunchWizard.tsx');
    expect(wizard).not.toMatch(/collectAttribution/);
    expect(wizard).not.toMatch(/\battribution\b/);
    for (const key of ATTRIBUTION_KEYS) {
      expect(wizard).not.toContain(key);
    }
  });

  it('active subscription checkout APIs do not accept or persist campaign attribution', () => {
    const guest = readRepoFile('../../pages/api/setup/subscription-checkout.ts');
    const launch = readRepoFile('../../pages/api/setup/launch-subscription-checkout.ts');
    for (const src of [guest, launch]) {
      expect(src).not.toMatch(/ATTRIBUTION_KEYS|pickAttribution/);
      expect(src).not.toMatch(/\battribution\b/);
      for (const key of ATTRIBUTION_KEYS) {
        expect(src).not.toContain(`'${key}'`);
      }
    }
  });

  it('dormant deposit checkout APIs also omit attribution handling', () => {
    const deposit = readRepoFile('../../pages/api/setup/deposit-checkout.ts');
    const launchDeposit = readRepoFile('../../pages/api/setup/launch-deposit-checkout.ts');
    for (const src of [deposit, launchDeposit]) {
      expect(src).not.toMatch(/ATTRIBUTION_KEYS|pickAttribution/);
      expect(src).not.toMatch(/\battribution\b/);
    }
  });

  it('Stripe metadata builders do not emit campaign fields', () => {
    const saas = buildSaasSubscriptionStripeMetadata({
      checkoutAttemptId: 'attempt-1',
      shopId: 'shop-1',
    });
    const deposit = buildSetupDepositStripeMetadata('priority');
    for (const metadata of [saas, deposit]) {
      for (const key of ATTRIBUTION_KEYS) {
        expect(metadata).not.toHaveProperty(key);
      }
    }
  });

  it('webhook and Resend fulfilment emails no longer include attributionSummary', () => {
    const webhook = readRepoFile('../../pages/api/shop/webhook.ts');
    const sender = readRepoFile('../email/sender.ts');
    expect(webhook).not.toMatch(/attributionSummary|ATTRIBUTION_META_KEYS/);
    expect(sender).not.toMatch(/attributionSummary/);
    expect(sender).not.toMatch(/<strong>Attribution:<\/strong>/);
  });

  it('Privacy no longer claims Stripe/email campaign persistence', () => {
    const privacy = readRepoFile('../../pages/privacy.astro');
    expect(privacy).toMatch(/does <strong>not<\/strong> separately persist those checkout\s+campaign identifiers into Stripe Checkout metadata or internal fulfilment email/);
    expect(privacy).not.toMatch(/pass advertising or campaign identifiers[\s\S]{0,120}into Stripe\s+session metadata/);
    expect(privacy).not.toMatch(/include a summary in internal fulfilment email/);
    expect(privacy).not.toMatch(/OPEN \/ LEGAL REVIEW — not resolved merely because Google Ads/);
    expect(privacy).toContain('Google Ads (currently inactive)');
    expect(privacy).toContain('INACTIVE / DORMANT');
  });

  it('Cookie Policy no longer claims checkout attribution persistence', () => {
    const cookies = readRepoFile('../../pages/cookies.astro');
    expect(cookies).toMatch(/does not pass these identifiers into setup\/subscription checkout, Stripe\s+metadata, or internal fulfilment email/);
    expect(cookies).not.toMatch(/Passed to Stripe metadata only when you voluntarily start/);
    expect(cookies).toMatch(/May remain in the page URL/);
    expect(cookies).toMatch(/GA4 may process relevant campaign\/source information only when Analytics/);
    expect(cookies).toMatch(/Google Ads remains inactive \/ dormant/);
    expect(cookies).toMatch(/does not store them in a dedicated attribution cookie or\s+localStorage/);
  });

  it('ROPA A13 records removed server-side checkout attribution', () => {
    const ropa = readRepoFile('../../../docs/compliance/ropa.md');
    expect(ropa).toMatch(/INACTIVE \/ REMOVED — SERVER-SIDE CHECKOUT ATTRIBUTION/);
    expect(ropa).not.toMatch(/Attribution lawful basis \*\*OPEN \/ LEGAL REVIEW\*\*/);
  });

  it('retention schedule closes the OPEN checkout-attribution retention requirement', () => {
    const schedule = readRepoFile('../../../docs/compliance/retention-schedule.md');
    expect(schedule).toContain('Future checkout attribution persistence: **REMOVED**');
    expect(schedule).toContain('current runtime no longer creates new copies');
    expect(schedule).not.toContain('ATTRIBUTION LAWFUL BASIS = OPEN / LEGAL REVIEW');
  });

  it('GA4 consent implementation and Ads dormancy contracts remain intact', () => {
    const consentConfig = readRepoFile('../consent/config.ts');
    const gaBootstrap = readRepoFile('../consent/googleAnalyticsBootstrap.test.ts');
    expect(consentConfig).toMatch(/CONSENT_VERSION\s*=\s*3/);
    expect(gaBootstrap).toContain('Ads-dormant');
  });
});
