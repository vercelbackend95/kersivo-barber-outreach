import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const query = ctx.url.searchParams.get("query")?.trim();
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const clients = await prisma.client.findMany({
    where: {
      shopId: shop.id,
      ...query ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } }
        ]
      } : {}
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      updatedAt: true
    }
  });
  return new Response(JSON.stringify({ clients }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
