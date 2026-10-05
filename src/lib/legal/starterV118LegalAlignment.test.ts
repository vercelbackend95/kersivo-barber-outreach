import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_DPA_VERSION } from './dpaVersion';
import { CURRENT_TERMS_VERSION } from './termsVersion';
import { SAAS_EXPORT_RETENTION_DAYS } from '@/lib/setup/saasEntitlement';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, '../../pages', name), 'utf8');
const terms = read('terms.astro');
const privacy = read('privacy.astro');
const dpa = read('dpa.astro');

describe('v1.18 legal/product alignment', () => {
  it('preserves Full KERSIVO £39/month while adding genuine Starter £0/month', () => {
    expect(terms).toContain('KERSIVO Starter — £0/month');
    expect(terms).toContain('Full KERSIVO — £{SAAS_MONTHLY_GBP}/month per physical location');
    expect(terms).toContain('Full KERSIVO is <strong>£{SAAS_MONTHLY_GBP}/month</strong> per physical location');
    expect(privacy).toContain('KERSIVO Starter at £0/month');
    expect(privacy).toContain('Full KERSIVO at £39/month per physical location');
    expect(dpa).toContain('Full KERSIVO is £39/month per physical location');
  });

  it('states 0% KERSIVO fee but keeps Stripe processing fees separate', () => {
    expect(terms).toContain('0% KERSIVO commission / platform / application fee');
    expect(terms).toContain('Standard Stripe payment-processing fees still apply');
    expect(privacy).toContain('0% KERSIVO application / platform fee');
    expect(privacy).toContain('Stripe processing fees are separate');
    expect(dpa).toContain('0% application / platform fee');
    expect(dpa).toContain('Stripe processing fees are');
  });

  it('uses Standard for new Connect onboarding while retaining historical Express compatibility', () => {
    for (const source of [terms, privacy, dpa]) {
      expect(source).toContain('Stripe Standard');
      expect(source).toMatch(/historical Express/i);
    }
    expect(terms).not.toContain('Stripe Connect Express with direct charges');
    expect(privacy).not.toContain('Stripe Connect Express / direct charges');
    expect(dpa).not.toContain('Stripe Connect Express with direct charges');
  });

  it('distinguishes Full downgrade from complete KERSIVO departure', () => {
    expect(terms).toContain('Ending a Full subscription does <strong>not</strong> automatically mean leaving KERSIVO');
    expect(terms).toContain('Existing future accepted');
    expect(terms).toContain('not silently deleted');
    expect(privacy).toContain('Moving from Full KERSIVO to KERSIVO Starter does');
    expect(privacy).toContain('not</strong> start the post-service retention window');
    expect(dpa).toContain('moving from Full KERSIVO to KERSIVO Starter does <strong>not</strong> end the Services');
    expect(SAAS_EXPORT_RETENTION_DAYS).toBe(30);
  });

  it('covers Starter boundaries, QR Kit and merchant-managed Google booking', () => {
    expect(terms).toContain('up to <strong>4 active bookable barbers</strong>');
    expect(terms).toContain('rolling <strong>90-day</strong>');
    expect(terms).toContain('<strong>Clients Core</strong>');
    expect(terms).toContain('<strong>OFFLINE</strong>');
    expect(terms).toContain('Starter QR Kit');
    expect(terms).toContain('Google Business Profile booking link');
    expect(terms).toContain('does not claim to edit Google automatically');
    expect(privacy).toContain('QR Kit fulfilment');
    expect(privacy).toContain('Google booking-link setup');
  });

  it('keeps the free-plan liability floor above zero and separates Stripe-paid revenue share', () => {
    expect(terms).toContain('greater of <strong>(a) £1,000</strong>');
    expect(terms).toContain('total fees paid by the Client to KERSIVO');
    expect(terms).toContain('compensation or revenue share from Stripe');
    expect(terms).toContain('not a commission or fee deducted');
    expect(privacy).toContain('partner compensation / revenue share');
    expect(dpa).toContain('partner compensation / revenue share');
  });

  it('bumps the material legal package versions together', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-05');
    expect(CURRENT_DPA_VERSION).toBe('2026-10-05');
    expect(privacy).toContain('Last updated: 5 October 2026');
  });
});
