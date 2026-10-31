import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('hub APIs keep the flag-off path (GLOBAL RULE 2)', () => {
  it('every hub API resolves through resolveHubApiContext, which 404s unless both flags are on', () => {
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('isHubRouteEnabled()');
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('hubNotFoundJson()');
    for (const file of [
      'src/pages/api/preview-hub/[token]/assets.ts',
      'src/pages/api/preview-hub/[token]/assets/[id].ts',
      'src/pages/api/preview-hub/[token]/details.ts',
    ]) {
      expect(read(file)).toContain('resolveHubApiContext');
    }
  });

  it('does not change the existing free-preview token APIs', () => {
    expect(read('src/pages/api/free-preview/[token]/changes.ts')).toContain('previewApiGuard');
    expect(read('src/pages/api/free-preview/[token]/changes.ts')).not.toContain('resolveHubApiContext');
    expect(read('src/pages/api/free-preview/[token]/event.ts')).toContain('previewApiGuard');
  });
});
