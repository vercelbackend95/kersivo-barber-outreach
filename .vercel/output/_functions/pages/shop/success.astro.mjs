import { e as createComponent, v as renderHead, r as renderTemplate, w as renderScript, h as createAstro } from '../../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import 'clsx';
/* empty css                                    */
/* empty css                                    */
/* empty css                                    */
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$Success = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Success;
  const orderId = Astro2.url.searchParams.get("orderId");
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Order confirmed</title>${renderHead()}</head> <body> <main class="container shop-page"> <section class="shop-card shop-success-card"> <div class="shop-card-body"> <h1>Order confirmed. Pick up in store.</h1> <p class="muted">Your pickup order is confirmed and paid in demo mode.</p> ${orderId ? renderTemplate`<p class="muted">Order ID: ${orderId}</p>` : null} <a href="/shop" class="btn btn--primary">Back to shop</a> </div> </section> </main> ${renderScript($$result, "C:/dev/kersivo-barber-outreach/src/pages/shop/success.astro?astro&type=script&index=0&lang.ts")} </body> </html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/shop/success.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/shop/success.astro";
const $$url = "/shop/success";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Success,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
