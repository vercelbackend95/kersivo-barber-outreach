import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('hub routes keep the flag-off path (GLOBAL RULE 2)', () => {
  it('root token page still uses resolvePreviewPageState when the hub is off', () => {
    const page = read('src/pages/preview/[token].astro');
    expect(page).toContain('if (isPreviewHubEnabled())');
    expect(page).toContain('resolvePreviewPageState({');
    expect(page).toContain('Astro.rewrite');
  });

  it('nested hub pages 404 unless both the flow flag and the hub flag are on', () => {
    for (const file of ['overview.astro', 'website.astro', 'details.astro', 'changes.astro', 'messages.astro']) {
      const page = read(`src/pages/preview/[token]/${file}`);
      expect(page).toContain('isHubRouteEnabled()');
      expect(page).toContain('hubNotFound()');
      expect(page).toContain('applyPrivatePreviewHeaders');
    }
    expect(read('src/lib/freePreview/hubPage.ts')).toContain('isFreePreviewFlowEnabled() && isPreviewHubEnabled()');
  });

  it('preview-launch keeps the old form when the hub flag is off', () => {
    const page = read('src/pages/admin/preview-launch.astro');
    expect(page).toContain('isPreviewHubEnabled()');
    expect(page).toContain('PreviewLaunchOnboarding');
    expect(page).toContain('!hubOn && prefill');
    expect(page).toContain('HubLaunchChecklist');
  });

  it('launch owner API stays 404 unless the old hub or the admin hub is on', () => {
    const src = read('src/lib/freePreview/hubLaunchApi.ts');
    expect(src).toContain('isHubRouteEnabled()');
    expect(src).toContain('isAdminHubRouteEnabled()');
  });

  it('nested hub pages apply private headers', () => {
    expect(read('src/lib/freePreview/previewHeaders.ts')).toContain("'X-Robots-Tag': 'noindex, nofollow'");
    expect(read('src/lib/freePreview/previewHeaders.ts')).toContain("'Referrer-Policy': 'no-referrer'");
    expect(read('src/lib/freePreview/previewHeaders.ts')).toContain("'Cache-Control': 'private, no-store'");
  });
});
