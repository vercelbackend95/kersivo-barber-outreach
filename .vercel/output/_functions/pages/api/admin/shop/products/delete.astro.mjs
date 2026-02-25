import { z } from 'zod';
import { r as requireAdmin } from '../../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../../renderers.mjs';

const prerender = false;
const deleteSchema = z.object({ id: z.string().min(1) });
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = deleteSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }
  try {
    const shopId = await resolveShopId();
    const existing = await prisma.product.findFirst({ where: { id: parsed.data.id, shopId }, select: { id: true } });
    if (!existing) {
      return new Response(JSON.stringify({ error: "Product not found." }), { status: 404 });
    }
    const product = await prisma.product.update({
      where: { id: parsed.data.id },
      data: { active: false }
    });
    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error("Failed to disable product", error);
    return new Response(JSON.stringify({ error: "Unable to disable product." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
