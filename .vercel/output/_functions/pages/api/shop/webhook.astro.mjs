import { p as prisma } from '../../../chunks/client_C4jvTHHS.mjs';
import { d as sendShopOrderConfirmationEmail } from '../../../chunks/sender_DNpVcW2v.mjs';
import { f as formatGbp } from '../../../chunks/money_D2KUCpNK.mjs';
import crypto from 'node:crypto';
export { renderers } from '../../../renderers.mjs';

const STRIPE_API_BASE = "https://api.stripe.com/v1";
function getSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return key;
}
async function retrieveCheckoutSession(sessionId) {
  const secretKey = getSecretKey();
  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe session lookup failed (${response.status}): ${text}`);
  }
  return await response.json();
}
function verifyStripeWebhookSignature(payload, signatureHeader) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  const elements = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = elements.find((part) => part.startsWith("t="))?.slice(2);
  const signature = elements.find((part) => part.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

const prerender = false;
const POST = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature || !verifyStripeWebhookSignature(rawBody, signature)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }
    const event = JSON.parse(rawBody);
    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const sessionId = event.data.object.id;
    const existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId }, select: { id: true } });
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }
    const session = await retrieveCheckoutSession(sessionId);
    const metadata = session.metadata ?? event.data.object.metadata ?? {};
    const customerEmail = (session.metadata?.customerEmail ?? event.data.object.customer_email ?? "").toLowerCase();
    const shopId = metadata.shopId;
    if (!shopId || !customerEmail) {
      return new Response(JSON.stringify({ error: "Missing metadata" }), { status: 400 });
    }
    const cart = JSON.parse(metadata.cart ?? "[]");
    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response(JSON.stringify({ error: "Missing cart metadata" }), { status: 400 });
    }
    const totalPence = typeof session.amount_total === "number" ? session.amount_total : cart.reduce((sum, item) => sum + item.lineTotalPence, 0);
    await prisma.order.create({
      data: {
        shopId,
        customerEmail,
        status: "PAID",
        currency: "gbp",
        totalPence,
        stripeSessionId: sessionId,
        paidAt: /* @__PURE__ */ new Date(),
        items: {
          create: cart.map((item) => ({
            productId: item.productId,
            nameSnapshot: item.name,
            unitPricePenceSnapshot: item.unitPricePence,
            quantity: item.quantity,
            lineTotalPence: item.lineTotalPence
          }))
        }
      }
    });
    await sendShopOrderConfirmationEmail({
      to: customerEmail,
      totalFormatted: formatGbp(totalPence),
      itemLines: cart.map((item) => `${item.name} × ${item.quantity} — ${formatGbp(item.lineTotalPence)}`)
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return new Response(JSON.stringify({ error: "Webhook handling failed" }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
