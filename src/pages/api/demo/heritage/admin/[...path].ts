export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveHeritageDemoFixture } from '../../../../../lib/admin/heritageDemoFixtures';

export const GET: APIRoute = async ({ params, url }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path ?? '';
  const fixturePath = `/api/demo/heritage/admin/${path}`;
  const result = await resolveHeritageDemoFixture(fixturePath, url.searchParams, 'GET');

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
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
};

export const POST: APIRoute = async ({ params, url, request }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path ?? '';
  const fixturePath = `/api/demo/heritage/admin/${path}`;
  const result = await resolveHeritageDemoFixture(fixturePath, url.searchParams, 'POST', request);

  if (!result) {
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
