import { r as requireAdmin } from '../../../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../../../renderers.mjs';

const prerender = false;
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const shopId = await resolveShopId();
  const orderId = ctx.params.id;
  if (!orderId) return new Response(JSON.stringify({ error: "Order ID required" }), { status: 400 });
  const order = await prisma.order.findFirst({ where: { id: orderId, shopId }, select: { id: true, status: true } });
  if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
  if (order.status !== "PAID") return new Response(JSON.stringify({ error: "Only PAID orders can be collected" }), { status: 400 });
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "COLLECTED", collectedAt: /* @__PURE__ */ new Date() }
  });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
