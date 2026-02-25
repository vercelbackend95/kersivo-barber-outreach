import { b as bookingCreateSchema } from '../../../chunks/schemas_FiF3e2IG.mjs';
import { d as createPendingBooking } from '../../../chunks/service_B7J0v9Yf.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const bucket = /* @__PURE__ */ new Map();
const WINDOW_MS = 10 * 60 * 1e3;
const LIMIT = 5;
function checkBookingRateLimit(ip) {
  const now = Date.now();
  const entries = (bucket.get(ip) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (entries.length >= LIMIT) {
    const oldest = entries[0] ?? now;
    return { ok: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1e3) };
  }
  entries.push(now);
  bucket.set(ip, entries);
  return { ok: true };
}

const prerender = false;
const getRequestIp = (request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
};
const POST = async ({ request }) => {
  const ip = getRequestIp(request);
  {
    const limit = checkBookingRateLimit(ip);
    if (!limit.ok) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try later.", retryAfter: limit.retryAfterSeconds }), {
        status: 429
      });
    }
    await prisma.rateLimitEvent.create({ data: { ip, action: "booking_create" } });
  }
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return new Response(JSON.stringify({ error: "Request body is required and must be valid JSON." }), { status: 400 });
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }
  const parsed = bookingCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request", issues: parsed.error.flatten() }), { status: 400 });
  }
  try {
    const booking = await createPendingBooking(parsed.data);
    return new Response(JSON.stringify({ bookingId: booking.id, status: booking.status }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Booking failed." }), { status: 400 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
