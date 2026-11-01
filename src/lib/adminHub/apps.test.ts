import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_HUB_APP_IDS, adminHubAppHref, adminHubAppMeta, parseAdminHubApp, resolveAdminHubApp } from './apps';

describe('admin hub apps', () => {
  it('parses known ids and rejects anything else', () => {
    for (const id of ADMIN_HUB_APP_IDS) {
      expect(parseAdminHubApp(id)).toBe(id);
    }
    expect(parseAdminHubApp('unknown')).toBeNull();
    expect(parseAdminHubApp('<script>')).toBeNull();
    expect(parseAdminHubApp('')).toBeNull();
  });

  it('opens the add-materials window as its own app', () => {
    expect(parseAdminHubApp('materials')).toBe('materials');
    expect(adminHubAppMeta('materials')).toMatchObject({
      title: 'Add photos or a logo',
      sheetBelow: 640,
    });
  });

  it('opens colours as its own app', () => {
    expect(resolveAdminHubApp('colours')).toBe('colours');
    expect(adminHubAppMeta('colours').title).toBe('Brand colours');
    expect(adminHubAppMeta('colours').crumb).toBe('Overview › Brand colours');
  });

  it('keeps messages on the narrow window', () => {
    expect(adminHubAppMeta('messages').maxWidth).toBe(720);
    expect(adminHubAppMeta('logo').maxWidth).toBe(1120);
    expect(adminHubAppHref('hours')).toBe('/admin?app=hours');
  });

  it('no longer treats services and team as hub apps', () => {
    expect(ADMIN_HUB_APP_IDS).not.toContain('services');
    expect(ADMIN_HUB_APP_IDS).not.toContain('team');
    expect(parseAdminHubApp('services')).toBeNull();
    expect(parseAdminHubApp('team')).toBeNull();
    const reviewApp = readFileSync(resolve(process.cwd(), 'src/components/adminHub/apps/ReviewApp.tsx'), 'utf8');
    const loadApp = readFileSync(resolve(process.cwd(), 'src/components/adminHub/apps/loadApp.ts'), 'utf8');
    expect(reviewApp).toContain('HoursApp');
    expect(reviewApp).not.toContain('ServicesApp');
    expect(reviewApp).not.toContain('TeamApp');
    expect(loadApp).toContain('hours:');
    expect(loadApp).not.toContain('services:');
    expect(loadApp).not.toContain('team:');
  });
});
