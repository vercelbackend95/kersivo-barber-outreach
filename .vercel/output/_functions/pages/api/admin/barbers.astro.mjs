import { z } from 'zod';
import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const schema = z.object({ id: z.string().optional(), name: z.string().min(1), email: z.string().email().optional().or(z.literal("")), active: z.boolean().default(true) });
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const barbers = await prisma.barber.findMany({ orderBy: { createdAt: "asc" } });
  return new Response(JSON.stringify({ barbers }));
};
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, email, ...rest } = parsed.data;
  const data = { ...rest, email: email || null };
  const barber = id ? await prisma.barber.update({ where: { id }, data }) : await prisma.barber.create({ data });
  return new Response(JSON.stringify({ barber }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
