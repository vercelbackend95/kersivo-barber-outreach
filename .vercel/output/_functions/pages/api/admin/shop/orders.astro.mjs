import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const shopId = await resolveShopId();
  const orders = await prisma.order.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerEmail: true,
      status: true,
      totalPence: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } }
    }
  });
  return new Response(JSON.stringify({ orders }), { status: 200 });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
