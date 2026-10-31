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

  it('opens colours as the logo app until Batch 4', () => {
    expect(resolveAdminHubApp('colours')).toBe('logo');
    expect(adminHubAppMeta('colours').title).toBe('Logo');
  });

  it('keeps messages on the narrow window', () => {
    expect(adminHubAppMeta('messages').maxWidth).toBe(720);
    expect(adminHubAppMeta('logo').maxWidth).toBe(1120);
    expect(adminHubAppHref('services')).toBe('/admin?app=services');
  });
});
