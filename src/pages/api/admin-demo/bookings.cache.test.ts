import { describe, expect, it } from 'vitest';
import { GET } from './[...path]';

function makeContext(search = 'date=2026-08-01&mode=day') {
  return {
    params: { path: 'bookings' },
    url: new URL(`https://kersivo.test/api/admin-demo/bookings?${search}`),
  } as never;
}

describe('GET /api/admin-demo/bookings cache headers', () => {
  it('sets public cache with s-maxage and stale-while-revalidate', async () => {
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const cache = res.headers.get('Cache-Control') ?? '';
    expect(cache).toContain('public');
    expect(cache).toContain('max-age=60');
    expect(cache).toContain('s-maxage=300');
    expect(cache).toContain('stale-while-revalidate=600');
  });
});
