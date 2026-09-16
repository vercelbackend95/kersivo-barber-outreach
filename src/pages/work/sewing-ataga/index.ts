import type { APIRoute } from 'astro';

/** Legacy portfolio URL — permanently gone; keep 410 so Google drops the indexed path. */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response('Gone', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
