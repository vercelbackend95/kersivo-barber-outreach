import { z } from 'zod';
import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../chunks/client_C4jvTHHS.mjs';
import { g as getTimeBlockDelegate } from '../../../../chunks/timeBlocks_6d7g-gTW.mjs';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
const schema = z.object({
  title: z.string().min(1).max(80),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  barberId: z.string().optional().nullable()
});
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { title, startAt, endAt, barberId } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return new Response(JSON.stringify({ error: "Invalid block range." }), { status: 400 });
  }
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  if (barberId) {
    const barber = await prisma.barber.findUnique({ where: { id: barberId }, select: { id: true } });
    if (!barber) return new Response(JSON.stringify({ error: "Barber not found." }), { status: 404 });
  }
  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(JSON.stringify({ error: "Prisma client is missing the timeBlock delegate. Run `npx prisma generate`." }), { status: 500 });
  }
  const timeBlock = await timeBlockDelegate.create({
    data: {
      shopId: shop.id,
      barberId: barberId ?? null,
      title,
      startAt: start,
      endAt: end
    },
    include: { barber: { select: { id: true, name: true } } }
  });
  return new Response(JSON.stringify({ timeBlock }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
