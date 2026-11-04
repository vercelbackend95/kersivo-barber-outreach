import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HUB_OPS_INSTAGRAM, HUB_OPS_TEXT_UPDATED, HUB_OPS_WEBSITE_EXTRA } from './hubCopy';

describe('ops preview-request website text', () => {
  it('shows Instagram, anything else and last-updated next to About', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/ops/preview-requests/[id].astro'), 'utf8');
    expect(src).toContain('HUB_OPS_ABOUT');
    expect(src).toContain('HUB_OPS_INSTAGRAM');
    expect(src).toContain('HUB_OPS_WEBSITE_EXTRA');
    expect(src).toContain('HUB_OPS_TEXT_UPDATED');
    expect(src).toContain('request.instagramUrl');
    expect(src).toContain('request.websiteExtraText');
    expect(src).not.toMatch(/set:html=\{request\.(aboutText|instagramUrl|websiteExtraText|styleNotes)\}/);
    expect(HUB_OPS_INSTAGRAM).toBe('Instagram');
    expect(HUB_OPS_WEBSITE_EXTRA).toBe('Anything else');
    expect(HUB_OPS_TEXT_UPDATED).toBe('Last updated');
  });

  it('Overview renders the Build brief as text and the tabs span the grid', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/ops/preview-requests/[id].astro'), 'utf8');
    const brief = readFileSync(resolve(process.cwd(), 'src/components/ops/previewRequests/OpsBuildBrief.astro'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/components/ops-preview-requests.css'), 'utf8');
    expect(page).toContain('loadBuildPack(request.id)');
    expect(page).toContain('<OpsBuildBrief');
    expect(page).toContain('<summary>Request admin</summary>');
    expect(brief).not.toContain('set:html');
    expect(brief).toContain('rel="noopener noreferrer nofollow"');
    expect(brief).toContain('loading="lazy"');
    expect(brief).not.toMatch(/storagePath/);
    expect(css).toMatch(/\.ops-pr-tabs \{\s*grid-column: 1 \/ -1;/);
  });
});
