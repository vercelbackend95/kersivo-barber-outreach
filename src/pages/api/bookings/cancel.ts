import type { APIRoute } from 'astro';
import { tokenSchema } from '../../../lib/booking/schemas';
import { cancelByManageToken } from '../../../lib/booking/service';

export const POST: APIRoute = async ({ request }) => {
  const parsed = tokenSchema.safeParse(await request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid token.' }), { status: 400 });

  try {
    const booking = await cancelByManageToken(parsed.data.token);
    return new Response(JSON.stringify({ booking }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to cancel.' }), { status: 400 });
  }
};
