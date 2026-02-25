import { z } from 'zod';
import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const schema = z.object({ id: z.string().optional(), name: z.string().min(1), durationMinutes: z.number().int().positive(), fromPriceText: z.string().optional(), bufferMinutes: z.number().int().min(0).default(0), active: z.boolean().default(true) });
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const services = await prisma.service.findMany({ orderBy: { createdAt: "asc" } });
  return new Response(JSON.stringify({ services }));
};
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, ...data } = parsed.data;
  const service = id ? await prisma.service.update({ where: { id }, data }) : await prisma.service.create({ data });
  return new Response(JSON.stringify({ service }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
