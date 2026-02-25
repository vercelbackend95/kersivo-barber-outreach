import { b as bookingCreateSchema } from '../../../../chunks/schemas_FiF3e2IG.mjs';
import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../chunks/client_C4jvTHHS.mjs';
import { t as toUtcFromLondon, a as addMinutes } from '../../../../chunks/time_Bf5AYUQW.mjs';
import { BookingStatus } from '@prisma/client';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
async function upsertClient(tx, input) {
  const shop = await tx.shopSettings.findFirstOrThrow({ select: { id: true } });
  return tx.client.upsert({
    where: { shopId_email: { shopId: shop.id, email: input.email } },
    update: {
      fullName: input.fullName,
      phone: input.phone ?? null
    },
    create: {
      shopId: shop.id,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null
    }
  });
}
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const parsed = bookingCreateSchema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const settings = await prisma.shopSettings.findFirstOrThrow();
  const service = await prisma.service.findUniqueOrThrow({ where: { id: parsed.data.serviceId } });
  const [h, m] = parsed.data.time.split(":").map(Number);
  const startAt = toUtcFromLondon(parsed.data.date, h * 60 + m);
  const endAt = addMinutes(startAt, service.durationMinutes + (service.bufferMinutes || settings.defaultBufferMinutes));
  const booking = await prisma.$transaction(async (tx) => {
    const client = await upsertClient(tx, {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone
    });
    return tx.booking.create({
      data: {
        service: { connect: { id: parsed.data.serviceId } },
        barber: { connect: { id: parsed.data.barberId } },
        client: { connect: { id: client.id } },
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        startAt,
        endAt,
        status: BookingStatus.CONFIRMED,
        manageTokenHash: `manual-${Date.now()}`
      },
      include: { service: true, barber: true }
    });
  });
  return new Response(JSON.stringify({ booking }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
