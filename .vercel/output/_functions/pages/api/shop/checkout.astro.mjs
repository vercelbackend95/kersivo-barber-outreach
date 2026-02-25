import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../../../chunks/shopScope_BH7VvEiX.mjs';
import { d as sendShopOrderConfirmationEmail } from '../../../chunks/sender_DNpVcW2v.mjs';
import { f as formatGbp } from '../../../chunks/money_D2KUCpNK.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const customerEmail = body.customerEmail?.trim().toLowerCase();
    if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
      return new Response(JSON.stringify({ error: "Valid customer email is required." }), { status: 400 });
    }
    const requestedItems = (body.items ?? []).map((item) => ({ productId: item.productId, quantity: Math.max(0, Math.floor(item.quantity ?? 0)) })).filter((item) => item.productId && item.quantity > 0);
    if (requestedItems.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty." }), { status: 400 });
    }
    const quantityByProduct = /* @__PURE__ */ new Map();
    for (const item of requestedItems) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    const shopId = await resolveShopId();
    const products = await prisma.product.findMany({
      where: { shopId, id: { in: [...quantityByProduct.keys()] }, active: true }
    });
    if (products.length !== quantityByProduct.size) {
      return new Response(JSON.stringify({ error: "Some products are unavailable." }), { status: 400 });
    }
    const snapshot = products.map((product) => {
      const quantity = quantityByProduct.get(product.id) ?? 0;
      return {
        productId: product.id,
        nameSnapshot: product.name,
        unitPricePenceSnapshot: product.pricePence,
        quantity,
        lineTotalPence: product.pricePence * quantity
      };
    });
    const totalPence = snapshot.reduce((sum, item) => sum + item.lineTotalPence, 0);
    const order = await prisma.order.create({
      data: {
        shopId,
        customerEmail,
        status: "PAID",
        currency: "gbp",
        totalPence,
        paidAt: /* @__PURE__ */ new Date(),
        items: {
          create: snapshot
        }
      },
      select: { id: true }
    });
    await sendShopOrderConfirmationEmail({
      to: customerEmail,
      totalFormatted: formatGbp(totalPence),
      itemLines: snapshot.map((item) => `${item.nameSnapshot} × ${item.quantity} — ${formatGbp(item.lineTotalPence)}`)
    });
    return new Response(JSON.stringify({ orderId: order.id }), { status: 200 });
  } catch (error) {
    console.error("Checkout error", error);
    return new Response(JSON.stringify({ error: "Unable to complete checkout." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
