import { e as createComponent, m as maybeRenderHead, k as renderComponent, q as Fragment, r as renderTemplate, h as createAstro } from '../../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
/* empty css                                    */
/* empty css                                    */
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$Confirm = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Confirm;
  const token = Astro2.url.searchParams.get("token") ?? "";
  let response;
  let booking;
  if (token) {
    const apiResponse = await fetch(new URL("/api/bookings/confirm", Astro2.url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    response = await apiResponse.json();
    booking = response.booking;
  }
  return renderTemplate`<html lang="en">${maybeRenderHead()}<body><main class="container page-wrap"><section class="surface booking-shell"><h1>Booking confirmation</h1>${booking ? renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": async ($$result2) => renderTemplate`<p>Your booking is now confirmed.</p><p>${booking.service.name} with ${booking.barber.name}</p><p>${new Date(booking.startAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>` })}` : renderTemplate`<p>${response?.error ?? "Missing token."}</p>`}</section></main></body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/book/confirm.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/book/confirm.astro";
const $$url = "/book/confirm";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Confirm,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
