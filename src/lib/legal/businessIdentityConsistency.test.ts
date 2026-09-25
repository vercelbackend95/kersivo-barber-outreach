import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LEGAL_OPERATOR_DISPLAY_NAME,
  LEGAL_OPERATOR_LOCATION,
  LEGAL_OPERATOR_NAME,
  TRADING_NAME,
} from './businessIdentity';
import { termsAcceptanceStripeMetadata } from './requireTermsAcceptance';
import { CURRENT_TERMS_VERSION, formatTermsLastUpdated } from './termsVersion';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const privacySource = readRepoFile('../../pages/privacy.astro');
const termsSource = readRepoFile('../../pages/terms.astro');
const cookiesSource = readRepoFile('../../pages/cookies.astro');
const dpaSource = readRepoFile('../../pages/dpa.astro');
const homepageSource = readRepoFile('../../pages/index.astro');
const booksyAlternativeSource = readRepoFile('../../pages/booksy-alternative/index.astro');
const footer50Source = readRepoFile('../../components/footer50.astro');

const FALSE_CORPORATE = [
  'KERSIVO Ltd',
  'Kersivo Ltd',
  'KERSIVO Limited',
  'Kersivo Limited',
] as const;

const SURFACES_WITH_IDENTITY = [privacySource, termsSource, cookiesSource, dpaSource] as const;
const MARKETING_SURFACES = [homepageSource, booksyAlternativeSource, footer50Source] as const;

describe('businessIdentity constants', () => {
  it('exports the canonical legal identity values', () => {
    expect(LEGAL_OPERATOR_NAME).toBe('Bartosz Jasinski');
    expect(TRADING_NAME).toBe('KERSIVO');
    expect(LEGAL_OPERATOR_DISPLAY_NAME).toBe('Bartosz Jasinski, trading as KERSIVO');
    expect(LEGAL_OPERATOR_LOCATION).toBe('Bournemouth, England, United Kingdom');
  });
});

describe('legal page identity wording', () => {
  it('Privacy Policy uses trading-as identity and updated date', () => {
    expect(privacySource).not.toContain('operating as a freelancer');
    expect(privacySource).toContain('{LEGAL_OPERATOR_NAME}');
    expect(privacySource).toContain('trading as {TRADING_NAME}');
    expect(privacySource).toContain('Last updated: 25 September 2026');
    expect(privacySource).toContain('href="/dpa"');
    expect(privacySource).toContain("from '@/lib/legal/businessIdentity'");
    expect(LEGAL_OPERATOR_NAME).toBe('Bartosz Jasinski');
    expect(TRADING_NAME).toBe('KERSIVO');
  });

  it('Terms of Service uses trading-as identity and no freelancer wording', () => {
    expect(termsSource).not.toContain('operating as a freelancer');
    expect(termsSource).toContain('{LEGAL_OPERATOR_NAME}');
    expect(termsSource).toContain('trading as {TRADING_NAME}');
    expect(termsSource).toContain("from '@/lib/legal/businessIdentity'");
    expect(LEGAL_OPERATOR_NAME).toBe('Bartosz Jasinski');
    expect(TRADING_NAME).toBe('KERSIVO');
  });

  it('Cookie Policy includes a concise trading-name disclosure', () => {
    expect(cookiesSource).toContain('{TRADING_NAME} is a trading name of {LEGAL_OPERATOR_NAME}');
    expect(cookiesSource).toContain('Last updated: 25 September 2026');
    expect(cookiesSource).toContain("from '@/lib/legal/businessIdentity'");
    expect(LEGAL_OPERATOR_NAME).toBe('Bartosz Jasinski');
    expect(TRADING_NAME).toBe('KERSIVO');
  });
});

describe('terms version and acceptance metadata', () => {
  it('CURRENT_TERMS_VERSION is 2026-09-23 and formats the human-readable date', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-09-23');
    expect(formatTermsLastUpdated(CURRENT_TERMS_VERSION)).toBe('23 September 2026');
  });

  it('Stripe terms acceptance metadata derives from CURRENT_TERMS_VERSION', () => {
    expect(termsAcceptanceStripeMetadata()).toEqual({
      terms_accepted: '1',
      terms_version: CURRENT_TERMS_VERSION,
    });
    expect(termsAcceptanceStripeMetadata().terms_version).toBe('2026-09-23');
  });
});

describe('marketing brand-only surfaces', () => {
  it('homepage, booksy-alternative, and Footer50 do not expose Bartosz Jasinski', () => {
    for (const source of MARKETING_SURFACES) {
      expect(source).not.toContain('Bartosz Jasinski');
    }
  });
});

describe('false corporate language', () => {
  it('does not describe KERSIVO as Ltd/Limited on legal or marketing surfaces', () => {
    for (const source of [...SURFACES_WITH_IDENTITY, ...MARKETING_SURFACES]) {
      for (const phrase of FALSE_CORPORATE) {
        expect(source).not.toContain(phrase);
      }
    }
  });
});
