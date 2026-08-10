import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('guest onboarding finale CTA', () => {
  const wizard = readFileSync(
    resolve(process.cwd(), 'src/components/admin/onboarding/OnboardingWizard.tsx'),
    'utf8',
  );
  const testBook = readFileSync(resolve(process.cwd(), 'src/pages/admin/test-book.astro'), 'utf8');

  it('uses Continue to test booking → /admin/test-book for guests', () => {
    expect(wizard).toContain("if (step === 6) return 'Continue to test booking'");
    expect(wizard).toContain("window.location.assign('/admin/test-book')");
    expect(wizard).not.toContain("isGuest ? 'See your dashboard'");
    expect(wizard).not.toContain("isGuest ? '/preview/dashboard' : '/admin/test-book'");
  });

  it('keeps session complete on test-book path', () => {
    expect(wizard).toContain("window.location.assign('/admin/test-book')");
  });

  it('allows preview cookie on test-book page', () => {
    expect(testBook).toContain('isTenantAdminAccess');
    expect(testBook).toContain("access.via === 'preview' ? '/preview/onboarding'");
    expect(testBook).not.toContain("access.via !== 'session'");
  });
});
