import { z } from 'zod';
import { r as requireAdmin } from '../../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../../../chunks/shopScope_BH7VvEiX.mjs';
export { renderers } from '../../../../../renderers.mjs';

const prerender = false;
const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  pricePence: z.number().int().positive("Price must be greater than zero."),
  imageUrl: z.string().url("Image URL must be a valid URL.").optional().or(z.literal("")),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0)
});
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = updateSchema.safeParse(await ctx.request.json());
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
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        pricePence: parsed.data.pricePence,
        imageUrl: parsed.data.imageUrl || null,
        active: parsed.data.active,
        featured: parsed.data.featured,
        sortOrder: parsed.data.sortOrder
      }
    });
    return new Response(JSON.stringify({ product }), { status: 200 });
  } catch (error) {
    console.error("Failed to update product", error);
    return new Response(JSON.stringify({ error: "Unable to update product." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
