import { z } from 'zod';
import { r as requireAdmin } from '../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const schema = z.object({ id: z.string().optional(), barberId: z.string(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().optional() });
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const rows = await prisma.barberTimeOff.findMany({ orderBy: { startsAt: "asc" } });
  return new Response(JSON.stringify({ timeOff: rows }));
};
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, startsAt, endsAt, ...data } = parsed.data;
  const payload = { ...data, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
  const row = id ? await prisma.barberTimeOff.update({ where: { id }, data: payload }) : await prisma.barberTimeOff.create({ data: payload });
  return new Response(JSON.stringify({ timeOff: row }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
