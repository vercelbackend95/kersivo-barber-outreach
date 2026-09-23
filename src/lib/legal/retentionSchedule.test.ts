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
    expect(schedule).toContain('do **not** claim live');
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

  it('keeps individual Client erasure and public Blob cleanup as pending', () => {
    expect(schedule).toContain('FEATURE PENDING (P0)');
    expect(schedule).toMatch(/Public Blob[\s\S]*ENFORCEMENT PENDING \(P0\)/);
    expect(schedule).toContain('best-effort only');
    expect(dpa).toContain('does not currently provide a self-service control that permanently erases');
    expect(privacy).not.toMatch(/shop admin can already erase individual customers/i);
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
    expect(ropa).not.toContain('RETENTION POLICY TO DEFINE');
  });
});
