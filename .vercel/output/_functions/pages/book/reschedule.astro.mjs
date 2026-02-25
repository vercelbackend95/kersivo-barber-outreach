import { e as createComponent, m as maybeRenderHead, k as renderComponent, q as Fragment, r as renderTemplate, h as createAstro } from '../../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import { B as BookingFlow } from '../../chunks/BookingFlow_BYLi4drE.mjs';
/* empty css                                    */
/* empty css                                    */
/* empty css                                    */
import { p as prisma } from '../../chunks/client_C4jvTHHS.mjs';
import { g as getRescheduleTokenStatus } from '../../chunks/service_B7J0v9Yf.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$Reschedule = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Reschedule;
  const token = Astro2.url.searchParams.get("token") ?? "";
  const tokenStatus = token ? await getRescheduleTokenStatus(token) : { valid: false, message: "Missing token." };
  const [services, barbers] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.barber.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } })
  ]);
  return renderTemplate`<html lang="en"> ${maybeRenderHead()}<body> <main class="container page-wrap"> <section class="surface booking-shell"> <h1>Reschedule booking</h1> ${tokenStatus.valid ? renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": async ($$result2) => renderTemplate` <p class="muted">Pick a new slot to update your confirmed booking.</p> ${renderComponent($$result2, "BookingFlow", BookingFlow, { "client:load": true, "mode": "reschedule", "token": token, "services": services, "barbers": barbers, "client:component-hydration": "load", "client:component-path": "C:/dev/kersivo-barber-outreach/src/components/booking/BookingFlow", "client:component-export": "default" })} ` })}` : renderTemplate`<p>${tokenStatus.message}</p>`} </section> </main> </body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/book/reschedule.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/book/reschedule.astro";
const $$url = "/book/reschedule";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Reschedule,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
