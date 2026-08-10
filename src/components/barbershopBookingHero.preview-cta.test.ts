import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('barbershopBookingHero CTAs', () => {
  const hero = readFileSync(
    resolve(process.cwd(), 'src/components/barbershopBookingHero.astro'),
    'utf8',
  );

  it('primary Get started CTA matches navbar: /admin/launch', () => {
    expect(hero).toMatch(
      /href="\/admin\/launch"\s+data-track="saas_subscribe_click"[\s\S]*?Get started/,
    );
    expect(hero).not.toMatch(/href="#pricing"\s+data-track="plan_my_setup_click"/);
  });

  it('See KERSIVO in action points to /preview/onboarding', () => {
    expect(hero).toContain('href="/preview/onboarding"');
    expect(hero).toContain('See KERSIVO in action');
    expect(hero).not.toMatch(/data-system-chooser-open[\s\S]{0,80}See KERSIVO in action/);
  });
});
