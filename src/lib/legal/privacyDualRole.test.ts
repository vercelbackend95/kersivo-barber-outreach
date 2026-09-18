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
    expect(privacySource).toContain('sub-processors');
    expect(privacySource).toContain('Vercel');
    expect(privacySource).toContain('Neon');
    expect(privacySource).toContain('Resend');
    expect(privacySource).toContain('Twilio');
    expect(privacySource).toContain('not listed above as general sub-processors');
  });

  it('aligns retention with export window and avoids blanket 6-year / instant-delete claims', () => {
    expect(privacySource).toContain('{SAAS_EXPORT_RETENTION_DAYS}');
    expect(SAAS_EXPORT_RETENTION_DAYS).toBe(30);
    expect(privacySource).toContain('does');
    expect(privacySource).toContain('not</strong> delete shop data instantly');
    expect(privacySource).toContain('does <strong>not</strong> mean all');
    expect(privacySource).toContain('six years');
    expect(privacySource).not.toMatch(/typically kept for up to <strong>6 years<\/strong>/);
  });
});
