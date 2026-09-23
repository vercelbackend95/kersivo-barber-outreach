import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAAS_EXPORT_RETENTION_DAYS } from '@/lib/setup/saasEntitlement';

const here = dirname(fileURLToPath(import.meta.url));
const privacySource = readFileSync(join(here, '../../pages/privacy.astro'), 'utf8');

describe('Privacy Policy dual-role DPA wording', () => {
  it('states barbershop controller / KERSIVO processor for Customer Personal Data', () => {
    expect(privacySource).toContain('When the barbershop is the controller');
    expect(privacySource).toContain('data controller');
    expect(privacySource).toContain('as a <strong>processor</strong>');
    expect(privacySource).toContain('barbershop is the controller');
    expect(privacySource).not.toMatch(/The data controller for this service is/);
  });

  it('carves out KERSIVO independent controller purposes', () => {
    expect(privacySource).toContain('independent controller');
    expect(privacySource).toContain('subscription and billing');
    expect(privacySource).toContain('terms acceptance');
    expect(privacySource).toContain('operational audit');
  });

  it('lists infrastructure sub-processors without inventing Stripe/Google as Art. 28 list', () => {
    const normalized = privacySource.replace(/\s+/g, ' ');
    expect(privacySource).toContain('sub-processors');
    expect(privacySource).toContain('Vercel');
    expect(privacySource).toContain('Neon');
    expect(privacySource).toContain('Resend');
    expect(privacySource).toContain('Twilio');
    expect(privacySource).toContain('Sentry');
    expect(privacySource).not.toContain('Slack');
    expect(privacySource).toContain('OpenAI');
    expect(normalized).toContain('optional admin AI assistant');
    expect(normalized).toContain('Free-text prompts submitted by authorised Client users may contain Customer Personal Data');
    expect(normalized).toContain('does not automatically export Client tenant databases to OpenAI');
    expect(privacySource).toContain('not listed above as general sub-processors');
    expect(privacySource).toContain('Last updated: 23 September 2026');
    expect(privacySource).not.toMatch(/End User Messaging/i);
    expect(privacySource).not.toMatch(/\bAWS\b/);

    const subProcessorsHeading = privacySource.indexOf('may process Customer\n        Personal Data as <strong>sub-processors</strong>');
    const otherProvidersHeading = privacySource.indexOf(
      'Other providers are used in specific functional contexts and are not listed above as general sub-processors',
    );
    expect(subProcessorsHeading).toBeGreaterThan(-1);
    expect(otherProvidersHeading).toBeGreaterThan(subProcessorsHeading);
    const subProcessorsBlock = privacySource.slice(subProcessorsHeading, otherProvidersHeading);
    expect(subProcessorsBlock).toContain('Vercel');
    expect(subProcessorsBlock).toContain('Neon');
    expect(subProcessorsBlock).toContain('Resend');
    expect(subProcessorsBlock).toContain('Twilio');
    expect(subProcessorsBlock).toContain('Sentry');
    expect(subProcessorsBlock).toContain('OpenAI');
    expect(subProcessorsBlock).not.toMatch(/Google Sign-In/i);
    expect(subProcessorsBlock).not.toMatch(/Google OAuth/i);
    expect(subProcessorsBlock).not.toMatch(/Sign in with Google/i);
    expect(subProcessorsBlock).not.toMatch(/\bStripe\b/);
  });

  it('describes current Stripe SaaS vs Connect roles without treating Stripe as a general CPD sub-processor', () => {
    const normalized = privacySource.replace(/\s+/g, ' ');
    expect(normalized).toContain('£39/month');
    expect(normalized).toContain('SaaS subscription billing');
    expect(normalized).toContain('does <strong>not</strong> receive or store full card numbers or CVC');
    expect(normalized).toContain('barbershop&rsquo;s connected Stripe account');
    expect(normalized).toContain('does <strong>not</strong> charge an application/platform commission');
    expect(normalized).toContain('processor for User-directed payment services');
    expect(normalized).toContain('independent controller for fraud prevention');
    expect(normalized).toContain('not</strong> listed above as a general {TRADING_NAME} Customer Personal Data sub-processor');
    expect(normalized).toContain('Historical setup deposits (not currently offered)');
    expect(normalized).toContain('requires confirmation with our legal adviser');
  });

  it('discloses optional Google Sign-In for KERSIVO account authentication', () => {
    const normalized = privacySource.replace(/\s+/g, ' ');
    expect(privacySource).toContain('Optional Sign in with Google');
    expect(privacySource).toContain('Continue with Google');
    expect(normalized).toContain('business/admin account');
    expect(normalized).toContain('authenticating you');
    expect(normalized).toContain('Google account identifier');
    expect(normalized).toContain('email address');
    expect(normalized).toContain('email verification status');
    expect(normalized).toContain('profile picture URL');
    expect(normalized).toContain('account linking');
    expect(privacySource).toContain('https://policies.google.com/privacy');
    expect(privacySource).toContain('Google Sign-In');
    expect(normalized).toContain('separate from Google Analytics');
  });

  it('states Google Sign-In does not access Gmail/Drive/Calendar and does not durably retain OAuth tokens', () => {
    const normalized = privacySource.replace(/\s+/g, ' ');
    expect(normalized).toContain('does <strong>not</strong> request access to Gmail, Google Drive, Calendar, Contacts');
    expect(normalized).toContain(
      'does <strong>not</strong> durably retain Google OAuth access tokens, refresh tokens or ID tokens',
    );
    expect(privacySource).not.toMatch(/request access to Gmail[\s\S]*on your behalf/i);
    expect(privacySource).not.toMatch(/reads your (Gmail|Google Drive|Calendar)/i);
  });

  it('aligns retention with export window and avoids blanket 6-year / instant-delete claims', () => {
    expect(privacySource).toContain('{SAAS_EXPORT_RETENTION_DAYS}');
    expect(SAAS_EXPORT_RETENTION_DAYS).toBe(30);
    expect(privacySource).toContain('does');
    expect(privacySource).toContain('not</strong> delete shop data instantly');
    expect(privacySource).toContain('does <strong>not</strong> mean all');
    expect(privacySource).toContain('six years');
    expect(privacySource).not.toMatch(/typically kept for up to <strong>6 years<\/strong>/);
    expect(privacySource).not.toMatch(/UK GDPR requires six years/i);
    expect(privacySource).toContain('not</strong> a claim that UK GDPR itself imposes a single six-year');
    expect(privacySource).toContain('does <strong>not</strong> independently apply a blanket deletion period');
    expect(privacySource).toContain('explicit account deletion');
    expect(privacySource).toContain('this right is not absolute');
    expect(privacySource).toContain('provider systems');
    expect(privacySource).toContain('Last updated: 23 September 2026');
    expect(privacySource).not.toMatch(/individual client erasure (is|feature) (now |currently )?live/i);
    expect(privacySource).not.toMatch(/self-service control that permanently erases an individual/i);
    expect(privacySource).toContain('requires confirmation with our legal adviser');
  });
});
