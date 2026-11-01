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
});
