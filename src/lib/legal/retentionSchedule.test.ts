import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAAS_EXPORT_RETENTION_DAYS } from '@/lib/setup/saasEntitlement';

const here = dirname(fileURLToPath(import.meta.url));

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(here, ...segments), 'utf8');
}

const schedule = readRepoFile('../../../docs/compliance/retention-schedule.md');
const ropa = readRepoFile('../../../docs/compliance/ropa.md');
const privacy = readRepoFile('../../pages/privacy.astro');
const dpa = readRepoFile('../../pages/dpa.astro');

describe('Retention schedule Phase 1 (docs)', () => {
  it('distinguishes approved policy from implemented enforcement', () => {
    expect(schedule).toContain('POLICY APPROVED — ENFORCEMENT PENDING');
    expect(schedule).toContain('POLICY APPROVED — FEATURE PENDING (P0)');
    expect(schedule).toContain('Currently implemented');
    expect(schedule).toContain('**IMPLEMENTED**');
  });

  it('preserves 30-day termination purge and avoids blanket six-year wording', () => {
    expect(SAAS_EXPORT_RETENTION_DAYS).toBe(30);
    expect(schedule).toContain('30-day');
    expect(schedule).toContain('purgeShopData');
    expect(schedule).toContain('KERSIVO purpose-specific choice');
    expect(schedule).not.toMatch(/UK GDPR requires six years/i);
    expect(schedule).toContain('not** a blanket GDPR six-year rule');
    expect(privacy).toContain('{SAAS_EXPORT_RETENTION_DAYS}');
    expect(dpa).toContain('{SAAS_EXPORT_RETENTION_DAYS}');
  });

  it('marks individual Client erasure IMPLEMENTED while keeping shop-wide public Blob open', () => {
    expect(schedule).toMatch(/Individual data-subject erasure[\s\S]*?\|\s*\*\*IMPLEMENTED\*\*/);
    expect(schedule).not.toMatch(
      /Individual data-subject erasure[\s\S]*?FEATURE PENDING \(P0\)/,
    );
    expect(schedule).toMatch(/shop-wide \/ tenant orphan cleanup[\s\S]*ENFORCEMENT PENDING \(P0\)/);
    expect(schedule).toContain('best-effort only');
    expect(schedule).toContain('Client-avatar scope only');
    expect(dpa).toMatch(/Authorised Client administrators[\s\S]*erase an individual/i);
    expect(dpa).not.toMatch(/not currently provide a self-service control that permanently erases/i);
    expect(dpa).not.toMatch(/not claimed as live functionality/i);
    expect(privacy).toMatch(/authorised barbershop admins can also instruct[\s\S]*erase an\s+individual/i);
  });

  it('does not overstate deletion of historical payments, provider residuals, or full public Blob cleanup', () => {
    expect(schedule).not.toMatch(/every historical transactional row is hard-deleted/i);
    expect(schedule).toContain('payment/Stripe/refund identifiers needed for transaction integrity remain');
    expect(schedule).toContain('PROVIDER VERIFICATION REQUIRED');
    expect(schedule).not.toMatch(/all public Blob data is automatically deleted/i);
    expect(dpa).toContain('does not necessarily hard-delete every historical transactional or payment');
    expect(dpa).toContain('Local deletion does not mean instantaneous erasure');
    expect(privacy).toContain('anonymised or minimised form');
  });

  it('keeps attribution lawful basis open and documents provider residual caveats', () => {
    expect(schedule).toContain('ATTRIBUTION LAWFUL BASIS = OPEN / LEGAL REVIEW');
    expect(schedule).toContain('PROVIDER VERIFICATION REQUIRED');
    expect(schedule).toContain('PROVIDER CONTROLLED');
    expect(ropa).toContain('OPEN / LEGAL REVIEW');
    expect(ropa).toContain('retention-schedule.md');
    expect(privacy).toContain('requires confirmation with our legal adviser');
    expect(privacy).toContain('provider systems');
    expect(dpa).toContain('Local deletion does not mean instantaneous erasure');
  });

  it('records approved controller periods without closing enforcement gaps', () => {
    expect(schedule).toContain('RateLimitEvent');
    expect(schedule).toContain('Target **30 days**');
    expect(schedule).toContain('StripeWebhookEvent');
    expect(schedule).toContain('12 months');
    expect(schedule).toContain('AccountLifecycleEvent');
    expect(schedule).toContain('SiteLaunchEvent');
    expect(schedule).toContain('LegalAcceptance');
    expect(schedule).toContain('SaasSubscription');
    expect(ropa).toContain('POLICY APPROVED — ENFORCEMENT PENDING');
    expect(ropa).toMatch(/Individual Client erasure[\s\S]*\*\*IMPLEMENTED\*\*/);
    expect(ropa).toMatch(/shop-wide public Blob[\s\S]*ENFORCEMENT PENDING \(P0\)|Shop-wide public Blob orphan cleanup: \*\*POLICY APPROVED — ENFORCEMENT PENDING \(P0\)\*\*/);
    expect(ropa).not.toContain('RETENTION POLICY TO DEFINE');
    expect(ropa).not.toMatch(/No individual Client DELETE API today/);
    expect(ropa).not.toMatch(/individual erasure feature pending/);
  });
});
