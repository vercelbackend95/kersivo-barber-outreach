import { t as tokenSchema } from '../../../chunks/schemas_FiF3e2IG.mjs';
import { a as cancelByManageToken, B as BookingActionError } from '../../../chunks/service_B7J0v9Yf.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const POST = async ({ request }) => {
  const parsed = tokenSchema.safeParse(await request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid token." }), { status: 400 });
  try {
    const booking = await cancelByManageToken(parsed.data.token);
    return new Response(JSON.stringify({ booking, message: "Your booking has been cancelled successfully." }), { status: 200 });
  } catch (error) {
    if (error instanceof BookingActionError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.statusCode });
    }
    return new Response(JSON.stringify({ error: "Unable to cancel booking right now. Please try again later." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
