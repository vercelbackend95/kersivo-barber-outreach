import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  try {
    const shopId = await resolveShopId();
    const products = await prisma.product.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
    });
    return new Response(JSON.stringify({ products }), { status: 200 });
  } catch (error) {
    console.error("Failed to load products", error);
    return new Response(JSON.stringify({ error: "Unable to load products." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
