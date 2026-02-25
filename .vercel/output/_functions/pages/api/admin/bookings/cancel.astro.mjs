import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { a as adminCancelBookingSchema } from '../../../../chunks/schemas_FiF3e2IG.mjs';
import { c as cancelByShop, B as BookingActionError } from '../../../../chunks/service_B7J0v9Yf.mjs';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = adminCancelBookingSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request payload." }), { status: 400 });
  }
  try {
    const booking = await cancelByShop({
      bookingId: parsed.data.bookingId,
      reason: parsed.data.reason || void 0
    });
    return new Response(JSON.stringify({ booking, message: "Booking cancelled successfully." }), { status: 200 });
  } catch (error) {
    if (error instanceof BookingActionError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: "BOOKING_ACTION_ERROR",
          status: error.statusCode
        }),
        { status: error.statusCode }
      );
    }
    console.error("Unhandled error while cancelling booking from admin endpoint.", error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return new Response(JSON.stringify({ error: "Unable to cancel booking right now. Please try again." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
