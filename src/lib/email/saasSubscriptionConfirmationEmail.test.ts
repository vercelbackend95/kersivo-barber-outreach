import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSaasSubscriptionConfirmationEmail } from './sender';

describe('buildSaasSubscriptionConfirmationEmail', () => {
  const recovery =
    'https://kersivo.co.uk/setup/success?session_id=cs_test_saas_email_1';

  afterEach(() => vi.unstubAllEnvs());

  it('points CTA to KERSIVO setup success recovery URL', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const { subject, html } = buildSaasSubscriptionConfirmationEmail({
      customerName: 'Alex',
      shopName: 'Fade Studio',
      monthlyFormatted: '£39',
      setupSuccessUrl: recovery,
    });

    expect(subject).toBe('Your KERSIVO subscription is confirmed');
    expect(html).toContain(recovery);
    expect(html).toContain('Complete Your KERSIVO Setup');
    expect(html).toContain('Your KERSIVO subscription is confirmed.');
  });

  it('hub flag on: subject and button become the launch checklist copy', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'true');
    const { subject, html } = buildSaasSubscriptionConfirmationEmail({
      customerName: 'Alex',
      shopName: 'Fade Studio',
      monthlyFormatted: '£39',
      setupSuccessUrl: recovery,
    });
    expect(subject).toBe("Let's put Fade Studio live");
    expect(html).toContain(recovery);
    expect(html).toContain('Open your launch checklist');
    expect(html).not.toContain('Complete Your KERSIVO Setup');
  });

  it('contains no Tally URL and no external onboarding form wording', () => {
    vi.stubEnv('PREVIEW_HUB_ENABLED', 'false');
    const { html } = buildSaasSubscriptionConfirmationEmail({
      customerName: 'Alex',
      shopName: 'Fade Studio',
      monthlyFormatted: '£39',
      setupSuccessUrl: recovery,
    });

    expect(html.toLowerCase()).not.toContain('tally');
    expect(html.toLowerCase()).not.toContain('tally.so');
    expect(html.toLowerCase()).not.toContain('onboarding form');
    expect(html).not.toContain('SETUP_ONBOARDING_FORM_URL');
  });
});
