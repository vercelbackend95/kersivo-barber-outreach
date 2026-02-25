import { e as createComponent, v as renderHead, r as renderTemplate } from '../../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import 'clsx';
/* empty css                                    */
/* empty css                                    */
/* empty css                                    */
export { renderers } from '../../renderers.mjs';

const $$Cancelled = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Checkout cancelled</title>${renderHead()}</head> <body> <main class="container shop-page"> <section class="shop-card shop-success-card"> <div class="shop-card-body"> <h1>Checkout cancelled</h1> <p class="muted">No payment was taken. Your cart is still available.</p> <a href="/shop" class="btn btn--primary">Return to cart</a> </div> </section> </main> </body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/shop/cancelled.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/shop/cancelled.astro";
const $$url = "/shop/cancelled";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Cancelled,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
