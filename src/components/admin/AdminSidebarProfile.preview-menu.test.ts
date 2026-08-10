import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('preview sidebar account menu', () => {
  it('AdminLayout wires preview profile mode when isPreviewAccess', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');
    expect(source).toContain('isPreviewAccess');
    expect(source).toContain('mode="preview"');
    expect(source).toContain('previewProfileUser');
  });

  it('AdminPanel sets isPreviewAccess from session via', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminPanel.tsx'), 'utf8');
    expect(source).toContain("setIsPreviewAccess(payload.via === 'preview')");
    expect(source).toContain('isPreviewAccess={demoMode ? false : isPreviewAccess}');
  });

  it('AdminSidebarProfile preview mode omits delete and preview website, keeps launch and logout', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/admin/AdminSidebarProfile.tsx'),
      'utf8',
    );
    expect(source).toContain("mode?: 'authenticated' | 'guest' | 'preview'");
    expect(source).toContain("const isPreview = mode === 'preview'");
    expect(source).toContain("isPreview ? 'Preview'");
    expect(source).toContain('!isPreview && shopId');
    expect(source).toContain('{!isPreview ? (');
    expect(source).toContain('Launch My Barbershop');
    expect(source).toContain('Log out');
    expect(source).toContain('Delete account');
  });
});
