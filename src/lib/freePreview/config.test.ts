import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(path.join(process.cwd(), 'src/lib/freePreview/config.ts'), 'utf8');

describe('isPreviewHubEnabled', () => {
  it('is a separate flag from the public flow, default off unless the value is exactly true', () => {
    expect(src).toContain('export function isPreviewHubEnabled()');
    expect(src).toContain("readEnv('PREVIEW_HUB_ENABLED') ?? '').trim().toLowerCase() === 'true'");
    expect(src).toContain('export function isFreePreviewFlowEnabled()');
  });
});

describe('isAnyHubEnabled', () => {
  it('is true when either hub flag is on so production can set ADMIN_HUB_ENABLED only', () => {
    expect(src).toContain('export function isAnyHubEnabled()');
    expect(src).toContain('return isPreviewHubEnabled() || isAdminHubEnabled()');
  });
});
