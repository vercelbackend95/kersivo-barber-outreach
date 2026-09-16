import { describe, expect, it } from 'vitest';
import { GET } from '../../pages/work/sewing-ataga/index';

describe('legacy /work/sewing-ataga', () => {
  it('returns HTTP 410 Gone', async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.status).toBe(410);
    expect(await response.text()).toBe('Gone');
  });
});
