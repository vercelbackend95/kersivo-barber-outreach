import { r as requireAdmin } from '../../../../chunks/auth_gRvu2ZyE.mjs';
import { p as prisma } from '../../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../../renderers.mjs';

const prerender = false;
const CANCELLED_STATUSES = ["CANCELLED_BY_CLIENT", "CANCELLED_BY_SHOP"];
const GET = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  const clientId = ctx.params.clientId;
  if (!clientId) return new Response(JSON.stringify({ error: "Missing client id." }), { status: 400 });
  const shop = await prisma.shopSettings.findFirstOrThrow({ select: { id: true } });
  const client = await prisma.client.findFirst({
    where: { id: clientId, shopId: shop.id },
    include: {
      bookings: {
        orderBy: { startAt: "desc" },
        take: 10,
        include: { barber: true, service: true }
      }
    }
  });
  if (!client) return new Response(JSON.stringify({ error: "Client not found." }), { status: 404 });
  const [totalBookings, lastBooking, cancelledCount] = await Promise.all([
    prisma.booking.count({ where: { clientId } }),
    prisma.booking.findFirst({ where: { clientId }, orderBy: { startAt: "desc" }, select: { startAt: true } }),
    prisma.booking.count({ where: { clientId, status: { in: [...CANCELLED_STATUSES] } } })
  ]);
  return new Response(JSON.stringify({
    client,
    stats: {
      totalBookings,
      lastBookingAt: lastBooking?.startAt ?? null,
      cancelledCount
    },
    recentBookings: client.bookings
  }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
