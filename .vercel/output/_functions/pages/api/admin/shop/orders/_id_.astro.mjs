import { r as requireAdmin } from '../../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../../renderers.mjs';

const prerender = false;
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const shopId = await resolveShopId();
  const orderId = ctx.params.id;
  if (!orderId) return new Response(JSON.stringify({ error: "Order ID required" }), { status: 400 });
  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: {
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          nameSnapshot: true,
          unitPricePenceSnapshot: true,
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
