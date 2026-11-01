import { describe, expect, it } from 'vitest';
import { HUB_MAX_BODY_BYTES } from './hubAssets';
import { HUB_UPLOAD_ERROR_TOO_LARGE_BODY } from './hubCopy';
import { readLimitedHubBody, rejectOversizedHubBody } from './hubApi';

describe('hub upload body limit', () => {
  it('rejects Content-Length over the cap', () => {
    const request = new Request('http://localhost/api/preview-hub/token/assets', {
      method: 'POST',
      headers: { 'content-length': String(HUB_MAX_BODY_BYTES + 1) },
    });
    const rejected = rejectOversizedHubBody(request);
    expect(rejected?.status).toBe(413);
  });

  it('rejects a streamed body over the cap even without Content-Length', async () => {
    const oversized = Buffer.alloc(HUB_MAX_BODY_BYTES + 64, 7);
    const request = new Request('http://localhost/api/preview-hub/token/assets', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Uint8Array(oversized),
      duplex: 'half',
    } as RequestInit);
    request.headers.delete('content-length');
    expect(rejectOversizedHubBody(request)).toBeNull();
    const limited = await readLimitedHubBody(request);
    expect(limited.ok).toBe(false);
    if (limited.ok) return;
    expect(limited.response.status).toBe(413);
    expect(await limited.response.json()).toMatchObject({ error: HUB_UPLOAD_ERROR_TOO_LARGE_BODY });
  });

  it('accepts a small body without Content-Length', async () => {
    const request = new Request('http://localhost/api/preview-hub/token/assets', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Uint8Array([1, 2, 3]),
      duplex: 'half',
    } as RequestInit);
    request.headers.delete('content-length');
    const limited = await readLimitedHubBody(request);
    expect(limited.ok).toBe(true);
  });
});
