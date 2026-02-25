import { r as rescheduleSchema } from '../../../chunks/schemas_FiF3e2IG.mjs';
import { r as rescheduleByToken, B as BookingActionError } from '../../../chunks/service_B7J0v9Yf.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const POST = async ({ request }) => {
  const parsed = rescheduleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request", issues: parsed.error.flatten() }), { status: 400 });
  }
  try {
    const booking = await rescheduleByToken(parsed.data);
    console.info("[BOOKING] Reschedule succeeded", { bookingId: booking.id, email: booking.email });
    return new Response(JSON.stringify({ booking }));
  } catch (error) {
    console.error("[BOOKING] Reschedule failed", { error, token: parsed.data.token });
    const status = error instanceof BookingActionError ? error.statusCode : 400;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to reschedule." }), { status });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
