import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Barbershop settings UI wiring', () => {
  it('profile menu exposes Barbershop settings for shop.settings', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminSidebarProfile.tsx'),
      'utf8',
    );
    expect(src).toMatch(/Barbershop settings/);
    expect(src).toMatch(/shop\.settings/);
    expect(src).toMatch(/onOpenBarbershopSettings/);
  });

  it('profile menu exposes Test online booking when shopId is known', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminSidebarProfile.tsx'),
      'utf8',
    );
    expect(src).toMatch(/Test online booking/);
    expect(src).toMatch(/\/book\/\$\{/);
  });

  it('AdminPanel mounts BarbershopSettingsPanel on barbershop_settings section', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminPanel.tsx'), 'utf8');
    expect(src).toMatch(/barbershop_settings/);
    expect(src).toMatch(/BarbershopSettingsPanel/);
  });
});
