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
const normalize = (value: string) => value.replace(/\s+/g, ' ');
const termsText = normalize(terms);
const privacyText = normalize(privacy);
const dpaText = normalize(dpa);

describe('v1.19 legal/product alignment', () => {
  it('preserves Full KERSIVO £39/month while adding genuine Starter £0/month', () => {
    expect(terms).toContain('KERSIVO Starter — £0/month');
    expect(terms).toContain('Full KERSIVO — £{SAAS_MONTHLY_GBP}/month per physical location');
    expect(terms).toContain('Full KERSIVO is <strong>£{SAAS_MONTHLY_GBP}/month</strong> per physical location');
    expect(privacy).toContain('KERSIVO Starter at £0/month');
    expect(privacy).toContain('Full KERSIVO at £39/month per physical location');
    expect(dpa).toContain('Full KERSIVO is £39/month per physical location');
  });

  it('states 0% KERSIVO fee but keeps Stripe processing fees separate', () => {
    expect(termsText).toContain('0% KERSIVO commission / platform / application fee');
    expect(terms).toContain('Standard Stripe payment-processing fees still apply');
    expect(privacyText).toContain('0% KERSIVO application / platform fee');
    expect(privacyText).toContain('Stripe processing fees are separate');
    expect(dpaText).toContain('0% application / platform fee');
    expect(dpaText).toContain('Stripe processing fees are');
  });

  it('requires Stripe Standard for Starter public launch while retaining historical Express compatibility', () => {
    for (const source of [termsText, privacyText, dpaText]) {
      expect(source).toContain('Stripe Standard');
      expect(source).toMatch(/historical Express/i);
      expect(source).toMatch(/Starter public-launch requirement|Starter public bookings can go live|public Starter bookings can go live/i);
    }
    expect(termsText).toContain('does <strong>not</strong> satisfy the Starter public-launch requirement');
    expect(terms).not.toContain('Starter may be used in Pay at shop mode without connecting Stripe');
    expect(terms).not.toContain('Stripe Connect Express with direct charges');
    expect(privacy).not.toContain('Stripe Connect Express / direct charges');
    expect(dpa).not.toContain('Stripe Connect Express with direct charges');
  });

  it('documents the fixed Starter public payment contract and Full payment-control boundary', () => {
    expect(termsText).toContain('<strong>£5 deposit</strong>');
    expect(termsText).toContain('<strong>Pay in full</strong>');
    expect(termsText).toContain('service priced exactly at £5 is paid in full');
    expect(termsText).toContain('no customer-created public Pay at shop mode on Starter');
    expect(termsText).toContain('active public-bookable Starter services must be priced at <strong>£5 or more</strong>');
    expect(privacyText).toContain('Public Pay at shop is not available on Starter');
    expect(dpaText).toContain('public Pay at shop is not a Starter customer-booking mode');
  });

  it('distinguishes Full downgrade from complete KERSIVO departure', () => {
    expect(termsText).toContain('Ending a Full subscription does <strong>not</strong> automatically mean leaving KERSIVO');
    expect(terms).toContain('Existing future accepted');
    expect(terms).toContain('not silently deleted');
    expect(privacyText).toContain('Moving from Full KERSIVO to KERSIVO Starter does');
    expect(privacyText).toContain('not</strong> start the post-service retention window');
    expect(dpaText).toContain('moving from Full KERSIVO to KERSIVO Starter does <strong>not</strong> end the Services');
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
    expect(termsText).toContain('greater of <strong>(a) £1,000</strong>');
    expect(termsText).toContain('total fees paid by the Client to KERSIVO');
    expect(termsText).toContain('compensation or revenue share from Stripe');
    expect(termsText).toContain('not a commission or fee deducted');
    expect(privacyText).toContain('partner compensation / revenue share');
    expect(dpaText).toContain('partner compensation / revenue share');
  });

  it('bumps the material legal package versions together', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-06');
    expect(CURRENT_DPA_VERSION).toBe('2026-10-06');
    expect(privacy).toContain('Last updated: 6 October 2026');
  });
});
