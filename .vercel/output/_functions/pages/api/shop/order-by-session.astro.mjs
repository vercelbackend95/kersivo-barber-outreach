import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const GET = async ({ request }) => {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return new Response(JSON.stringify({ error: "session_id is required" }), { status: 400 });
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: {
      id: true,
      customerEmail: true,
      totalPence: true,
      currency: true,
      status: true,
      items: {
        select: {
          id: true,
          nameSnapshot: true,
          quantity: true,
          lineTotalPence: true
        }
      }
    }
  });
  if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
  return new Response(JSON.stringify({ order }), { status: 200 });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
