import { z } from 'zod';
import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { g as getTimeBlockDelegate } from '../../../../chunks/timeBlocks_6d7g-gTW.mjs';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
const schema = z.object({ id: z.string().min(1) });
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(JSON.stringify({ error: "Prisma client is missing the timeBlock delegate. Run `npx prisma generate`." }), { status: 500 });
  }
  await timeBlockDelegate.delete({ where: { id: parsed.data.id } });
  return new Response(JSON.stringify({ ok: true }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
