import { describe, expect, it } from 'vitest';
import { buildSaasSubscriptionConfirmationEmail } from './sender';

describe('buildSaasSubscriptionConfirmationEmail', () => {
  const recovery =
    'https://kersivo.co.uk/setup/success?session_id=cs_test_saas_email_1';

  it('points CTA to KERSIVO setup success recovery URL', () => {
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

  it('contains no Tally URL and no external onboarding form wording', () => {
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
