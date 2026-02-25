import { e as createComponent, m as maybeRenderHead, r as renderTemplate, h as createAstro } from '../../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import 'clsx';
/* empty css                                    */
/* empty css                                    */
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$Cancel = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Cancel;
  const token = Astro2.url.searchParams.get("token") ?? "";
  let message = "Missing cancellation link. Please use the link from your booking email.";
  let isError = true;
  if (token) {
    try {
      const apiResponse = await fetch(new URL("/api/bookings/cancel", Astro2.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const payload = await apiResponse.json();
      if (apiResponse.ok) {
        message = payload?.message ?? "Your booking has been cancelled successfully.";
        isError = false;
      } else {
        message = payload?.error ?? "We could not cancel this booking. Please contact the shop for help.";
      }
    } catch {
      message = "We could not cancel this booking right now. Please try again shortly.";
    }
  }
  return renderTemplate`<html lang="en"> ${maybeRenderHead()}<body> <main class="container page-wrap"> <section class="surface booking-shell"> <h1>Cancel booking</h1> <p>${message}</p> ${isError && renderTemplate`<p class="muted">If this keeps happening, please contact the barbershop directly.</p>`} </section> </main> </body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/pages/book/cancel.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/book/cancel.astro";
const $$url = "/book/cancel";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Cancel,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
