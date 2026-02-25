import { r as requireAdmin } from '../../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../../../renderers.mjs';

const prerender = false;
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: "Missing client id." }), { status: 400 });
  const payload = await ctx.request.json().catch(() => null);
  if (!payload || typeof payload.notes !== "string") {
    return new Response(JSON.stringify({ error: "Invalid notes payload." }), { status: 400 });
  }
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const updated = await prisma.client.updateMany({
    where: { id: clientId, shopId: shop.id },
    data: { notes: payload.notes }
  });
  if (updated.count === 0) {
    return new Response(JSON.stringify({ error: "Client not found." }), { status: 404 });
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, notes: true, updatedAt: true }
  });
  return new Response(JSON.stringify({ client }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
