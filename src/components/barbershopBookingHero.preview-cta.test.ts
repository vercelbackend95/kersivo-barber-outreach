import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('hero See KERSIVO in action CTA', () => {
  it('points to /preview/onboarding', () => {
    const hero = readFileSync(
      resolve(process.cwd(), 'src/components/barbershopBookingHero.astro'),
      'utf8',
    );
    expect(hero).toContain('href="/preview/onboarding"');
    expect(hero).toContain('See KERSIVO in action');
    expect(hero).not.toMatch(/data-system-chooser-open[\s\S]{0,80}See KERSIVO in action/);
  });
});
