import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('guest onboarding finale CTA', () => {
  const wizard = readFileSync(
    resolve(process.cwd(), 'src/components/admin/onboarding/OnboardingWizard.tsx'),
    'utf8',
  );

  it('points guest complete to /preview/dashboard with See your dashboard label', () => {
    expect(wizard).toContain("isGuest ? 'See your dashboard' : 'Continue to test booking'");
    expect(wizard).toContain("isGuest ? '/preview/dashboard' : '/admin/test-book'");
    expect(wizard).toContain("isGuest ? '/preview/dashboard' : '/admin'");
    expect(wizard).not.toContain("isGuest ? 'Continue to subscribe'");
    expect(wizard).not.toContain("isGuest ? '/admin/launch' : '/admin/test-book'");
  });

  it('keeps session complete on test-book path', () => {
    expect(wizard).toContain("isGuest ? '/preview/dashboard' : '/admin/test-book'");
  });
});
