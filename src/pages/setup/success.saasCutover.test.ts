import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('setup/success.astro SaaS cutover (static)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, 'success.astro'), 'utf8');

  it('SaaS branch mounts KERSIVO continue island and keeps purchase tracking', () => {
    expect(source).toContain('SetupSuccessSaasContinue');
    expect(source).toContain('YOUR SUBSCRIPTION IS CONFIRMED.');
    expect(source).toContain('kersivo-saas-purchase-track');
    expect(source).toContain('data-transaction-id={verified.transactionId}');
    expect(source).toContain('data-value={String(verified.monthlyValueGbp)}');
    expect(source).toContain('clearSaasCheckoutAttemptId');
    expect(source).toContain('startSaasPurchaseTracking');
  });

  it('SaaS branch no longer uses Tally / onboarding form CTA copy', () => {
    expect(source).toContain('Nothing goes live without your approval.');
    const saasSection = source.slice(
      source.indexOf('verified && isSubscription'),
      source.indexOf("verified.kind === 'setup_deposit'"),
    );
    expect(saasSection).not.toContain('onboardingFormUrl');
    expect(saasSection).not.toContain('We’ve sent your onboarding form');
    expect(saasSection).not.toContain('Complete Your Onboarding');
    expect(saasSection).not.toContain('getSetupOnboardingFormUrlOrEmpty');
  });

  it('keeps unverified path safe (no onboarding deep-link)', () => {
    expect(source).toContain('WE COULDN’T VERIFY THIS PAYMENT YET.');
    expect(source).toContain('Back to pricing');
  });
});
