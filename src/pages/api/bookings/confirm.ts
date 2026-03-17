export const prerender = false;

import type { APIRoute } from 'astro';
export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({ error: 'Booking confirmation by email is no longer required. Bookings are confirmed instantly after form submission.' }),
    { status: 410 }
  );

};
