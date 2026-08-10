import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AdminLayout preview banner', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');

  it('pitches dashboard preview and subscribe, not under construction', () => {
    expect(source).toContain('This is how your dashboard will look.');
    expect(source).toContain("Subscribe and we&apos;ll build your website");
    expect(source).toContain('Get started — £39/month');
    expect(source).not.toContain('Your shop is under construction.');
  });

  it('wraps banner and mobile header in admin-mobile-top-chrome for measured spacer', () => {
    expect(source).toContain('admin-mobile-top-chrome');
    expect(source).toMatch(
      /admin-mobile-top-chrome[\s\S]*?admin-barbershop-paused-banner[\s\S]*?admin-mobile-header/,
    );
    expect(source).toContain('.admin-mobile-top-chrome');
  });

  it('supports dismissible preview subscribe banner with session re-show', () => {
    expect(source).toContain('dismissPreviewSubscribeBanner');
    expect(source).toContain('notePreviewSubscribeBannerSectionChange');
    expect(source).toContain('admin-barbershop-paused-banner__dismiss');
    expect(source).toContain('aria-label="Dismiss"');
    expect(source).toContain('Preview of your dashboard.');
  });
});
