import { t as tokenSchema } from '../../../chunks/schemas_FiF3e2IG.mjs';
import { b as confirmBookingByToken, B as BookingActionError } from '../../../chunks/service_B7J0v9Yf.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const POST = async ({ request }) => {
  const parsed = tokenSchema.safeParse(await request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid token." }), { status: 400 });
  try {
    const booking = await confirmBookingByToken(parsed.data.token);
    return new Response(JSON.stringify({ booking }));
  } catch (error) {
    const status = error instanceof BookingActionError ? error.statusCode : 400;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to confirm." }), { status });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
