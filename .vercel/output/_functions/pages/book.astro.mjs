import { e as createComponent, m as maybeRenderHead, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import { B as BookingFlow } from '../chunks/BookingFlow_BYLi4drE.mjs';
import { p as prisma } from '../chunks/client_C4jvTHHS.mjs';
/* empty css                                 */
/* empty css                                 */
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const [services, barbers] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.barber.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })
  ]);
  return renderTemplate`<html lang="en"> ${maybeRenderHead()}<body> <main class="container page-wrap"> ${renderComponent($$result, "BookingFlow", BookingFlow, { "client:load": true, "services": services, "barbers": barbers, "client:component-hydration": "load", "client:component-path": "C:/dev/kersivo-barber-outreach/src/components/booking/BookingFlow", "client:component-export": "default" })} </main> </body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/book/index.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/book/index.astro";
const $$url = "/book";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
