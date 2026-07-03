export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveDemoFixture } from '../../../lib/admin/demoFixtureRouter';

export const GET: APIRoute = async ({ params, url }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path ?? '';
  const fixturePath = `/api/admin-demo/${path}`;
  const result = resolveDemoFixture(fixturePath, url.searchParams);

  if (!result) {
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
