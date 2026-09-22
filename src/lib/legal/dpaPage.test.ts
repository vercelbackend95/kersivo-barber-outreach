import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_DPA_VERSION, formatDpaLastUpdated } from './dpaVersion';
import { CURRENT_TERMS_VERSION } from './termsVersion';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const dpaSource = readRepoFile('../../pages/dpa.astro');
const termsSource = readRepoFile('../../pages/terms.astro');
const launchWizardSource = readRepoFile('../../components/admin/launch/LaunchWizard.tsx');
const legalFooterSource = readRepoFile('../../components/LegalFooter.astro');

const FALSE_CORPORATE = [
  'KERSIVO Ltd',
  'Kersivo Ltd',
  'KERSIVO Limited',
  'Kersivo Limited',
] as const;

describe('dpaVersion', () => {
  it('exports CURRENT_DPA_VERSION 2026-09-22 and formats Last updated', () => {
    expect(CURRENT_DPA_VERSION).toBe('2026-09-22');
    expect(formatDpaLastUpdated(CURRENT_DPA_VERSION)).toBe('22 September 2026');
  });

  it('documents that material DPA updates require a Terms bump', () => {
    const src = readRepoFile('dpaVersion.ts');
    expect(src).toContain('CURRENT_TERMS_VERSION');
    expect(src).toContain('MATERIAL DPA update');
  });
});

describe('Data Processing Agreement page', () => {
  it('exists with canonical identity and dual-role framing', () => {
    expect(dpaSource).toContain("from '@/lib/legal/businessIdentity'");
    expect(dpaSource).toContain('{LEGAL_OPERATOR_NAME}');
    expect(dpaSource).toContain('trading as {TRADING_NAME}');
    expect(dpaSource).toContain('Client is the Controller');
    expect(dpaSource).toContain('Processor');
    expect(dpaSource).toContain('independent Controller');
    expect(dpaSource).toContain('outside');
    expect(dpaSource).toContain('href="/privacy"');
    expect(dpaSource).toContain('forms part of the');
    expect(dpaSource).toContain('href="/terms"');
  });

  it('includes core Article 28-style clauses', () => {
    expect(dpaSource).toContain('Documented instructions');
    expect(dpaSource).toContain('Confidentiality');
    expect(dpaSource).toContain('Schedule 3');
    expect(dpaSource).toContain('general written authorisation');
    expect(dpaSource).toContain('14 days');
    expect(dpaSource).toContain('International transfers');
    expect(dpaSource).toContain('UK International Data Transfer Agreement');
    expect(dpaSource).toContain('Data subject rights');
    expect(dpaSource).toContain('without undue delay');
    expect(dpaSource).toContain('Return and deletion');
    expect(dpaSource).toContain('Audit and compliance');
    expect(dpaSource).toContain('special category');
    expect(dpaSource).toContain('England and Wales');
  });

  it('includes Schedules 1–3 and approved Sub-processors', () => {
    expect(dpaSource).toContain('Schedule 1');
    expect(dpaSource).toContain('Schedule 2');
    expect(dpaSource).toContain('Schedule 3');
    expect(dpaSource).toContain('Vercel');
    expect(dpaSource).toContain('Neon (Databricks)');
    expect(dpaSource).toContain('Resend');
    expect(dpaSource).toContain('Twilio');
    expect(dpaSource).toContain('Sentry');
    expect(dpaSource).not.toContain('Slack');
    expect(dpaSource).toContain('OpenAI');
    expect(dpaSource).toContain('Only where SMS functionality is enabled');
    expect(dpaSource).toContain('Only where SENTRY_DSN');
    expect(dpaSource).not.toContain('OPS_SLACK_WEBHOOK_URL');
    expect(dpaSource).toContain('OPENAI_API_KEY');
    expect(dpaSource).toContain('Admin AI assistant / language-model processing');
    expect(dpaSource).toContain('Minimised/scrubbed operational telemetry');
  });

  it('does not add Google OAuth as a Schedule 2 Sub-processor', () => {
    const schedule2Start = dpaSource.indexOf('Schedule 2 — Approved Sub-processors');
    const notListedStart = dpaSource.indexOf(
      'The following are <strong>not</strong> listed as Sub-processors for Customer Personal Data under this DPA:',
    );
    expect(schedule2Start).toBeGreaterThan(-1);
    expect(notListedStart).toBeGreaterThan(schedule2Start);
    const schedule2Table = dpaSource.slice(schedule2Start, notListedStart);
    expect(schedule2Table).toContain('Vercel');
    expect(schedule2Table).toContain('Neon');
    expect(schedule2Table).toContain('Resend');
    expect(schedule2Table).toContain('Twilio');
    expect(schedule2Table).toContain('Sentry');
    expect(schedule2Table).toContain('OpenAI');
    expect(schedule2Table).not.toMatch(/Google OAuth/i);
    expect(schedule2Table).not.toMatch(/Google Sign-In/i);
    const notListedEnd = dpaSource.indexOf('</p>', notListedStart);
    const notListedBlock = dpaSource.slice(notListedStart, notListedEnd);
    expect(notListedBlock).toMatch(/Google OAuth/);
    expect(notListedBlock).toMatch(/account\/auth/);
    expect(CURRENT_DPA_VERSION).toBe('2026-09-22');
    expect(CURRENT_TERMS_VERSION).toBe('2026-09-22');
  });

  it('lists OpenAI as conditional Sub-processor and does not exclude it from CPD Sub-processors', () => {
    expect(dpaSource).toContain('Only where the {TRADING_NAME} admin AI assistant is enabled and OPENAI_API_KEY is configured');
    expect(dpaSource).toContain('Current OpenAI Data Processing Addendum');
    expect(dpaSource).toContain('OpenAI note');
    expect(dpaSource).toContain('catalogue');
    expect(dpaSource).not.toContain(
      'OpenAI (catalogue semantics only by current design, not Customer Personal Data)',
    );
    const notListedStart = dpaSource.indexOf(
      'The following are <strong>not</strong> listed as Sub-processors for Customer Personal Data under this DPA:',
    );
    expect(notListedStart).toBeGreaterThan(-1);
    const notListedEnd = dpaSource.indexOf('</p>', notListedStart);
    expect(notListedEnd).toBeGreaterThan(notListedStart);
    const notListedBlock = dpaSource.slice(notListedStart, notListedEnd);
    expect(notListedBlock).not.toMatch(/OpenAI/);
  });

  it('keeps Twilio conditional and does not list AWS as an active Sub-processor', () => {
    expect(dpaSource).toContain('Twilio');
    expect(dpaSource).toContain('Only where SMS functionality is enabled');
    expect(dpaSource).not.toMatch(/End User Messaging/i);
    expect(dpaSource).not.toMatch(/\bAWS\b/);
    expect(CURRENT_DPA_VERSION).toBe('2026-09-22');
  });

  it('does not list Stripe Connect as a normal KERSIVO Sub-processor', () => {
    expect(dpaSource).toContain('Stripe Connect note');
    expect(dpaSource).toContain('not listed above as a');
    expect(dpaSource).toContain('normal {TRADING_NAME} Sub-processor');
  });

  it('avoids false corporate and invented registration claims', () => {
    for (const phrase of FALSE_CORPORATE) {
      expect(dpaSource).not.toContain(phrase);
    }
    expect(dpaSource).not.toMatch(/company number/i);
    expect(dpaSource).not.toMatch(/VAT number/i);
    expect(dpaSource).not.toMatch(/ICO registration/i);
    expect(dpaSource).not.toMatch(/\b\d{1,3}\s+[A-Z][a-z]+\s+(Street|Road|Avenue|Lane)\b/);
  });
});

describe('Terms / checkout / footer DPA integration', () => {
  it('Terms incorporate /dpa and share the bumped Terms version', () => {
    expect(CURRENT_TERMS_VERSION).toBe('2026-09-22');
    expect(termsSource).toContain('href="/dpa"');
    expect(termsSource).toContain('forms part of these Terms');
    expect(termsSource).toContain('Client is the Controller');
    expect(termsSource).toContain('Processor');
  });

  it('LaunchWizard keeps a single Terms checkbox and references the DPA', () => {
    const checkboxCount = (launchWizardSource.match(/name="termsAccepted"/g) ?? []).length;
    expect(checkboxCount).toBe(1);
    expect(launchWizardSource).not.toMatch(/name="dpaAccepted"/);
    expect(launchWizardSource).toContain('href="/dpa"');
    expect(launchWizardSource).toContain('Data Processing Agreement');
    expect(launchWizardSource).toContain('Terms of Service');
  });

  it('LegalFooter links to /dpa', () => {
    expect(legalFooterSource).toContain("href: '/dpa'");
    expect(legalFooterSource).toContain('Data Processing Agreement');
  });
});
