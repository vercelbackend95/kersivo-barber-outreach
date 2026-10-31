import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PREVIEW_HUB_MESSAGES_IP_RATE,
  PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE,
  PREVIEW_HUB_MESSAGES_REQUEST_HOUR_RATE,
} from './hubApi';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('hub APIs keep the flag-off path (GLOBAL RULE 2)', () => {
  it('every hub API resolves through resolveHubApiContext, which 404s unless both flags are on', () => {
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('isHubRouteEnabled()');
    expect(read('src/lib/freePreview/hubApi.ts')).toContain('hubNotFoundJson()');
    for (const file of [
      'src/pages/api/preview-hub/[token]/assets.ts',
      'src/pages/api/preview-hub/[token]/assets/[id].ts',
      'src/pages/api/preview-hub/[token]/details.ts',
      'src/pages/api/preview-hub/[token]/messages.ts',
      'src/pages/api/preview-hub/[token]/messages/read.ts',
      'src/pages/api/preview-hub/[token]/reviews.ts',
      'src/pages/api/preview-hub/[token]/changes.ts',
      'src/pages/api/preview-hub/[token]/changes/[id].ts',
      'src/pages/api/preview-hub/[token]/changes/send.ts',
    ]) {
      expect(read(file)).toContain('(tokenSourceOf)');
    }
    for (const file of ['assets', 'assetById', 'changes', 'details', 'messages', 'reviews']) {
      const handler = read(`src/lib/previewHub/handlers/${file}.ts`);
      expect(handler).toContain('resolveHubApiContext');
      expect(handler).not.toMatch(/resolveHubApiContext\(\{[^}]*token:/);
    }
  });

  it('enforces per-IP and per-request message rate limits', () => {
    expect(PREVIEW_HUB_MESSAGES_IP_RATE.limit).toBe(20);
    expect(PREVIEW_HUB_MESSAGES_REQUEST_HOUR_RATE.limit).toBe(20);
    expect(PREVIEW_HUB_MESSAGES_REQUEST_DAY_RATE.limit).toBe(100);
    expect(read('src/lib/previewHub/handlers/messages.ts')).toContain('enforceHubMessageRates');
  });

  it('does not change the existing free-preview token APIs', () => {
    expect(read('src/pages/api/free-preview/[token]/changes.ts')).toContain('previewApiGuard');
    expect(read('src/pages/api/free-preview/[token]/changes.ts')).not.toContain('resolveHubApiContext');
    expect(read('src/pages/api/free-preview/[token]/event.ts')).toContain('previewApiGuard');
  });
});
