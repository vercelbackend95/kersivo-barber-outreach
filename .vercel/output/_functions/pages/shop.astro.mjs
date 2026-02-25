import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, g as addAttribute } from '../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import { $ as $$MainLayout } from '../chunks/MainLayout_DnE2OrBp.mjs';
import { p as prisma } from '../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../chunks/shopScope_BH7VvEiX.mjs';
import { f as formatGbp } from '../chunks/money_D2KUCpNK.mjs';
export { renderers } from '../renderers.mjs';

const $$Shop = createComponent(async ($$result, $$props, $$slots) => {
  const shopId = await resolveShopId();
  const products = await prisma.product.findMany({
    where: { shopId, active: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }]
  });
  return renderTemplate`${renderComponent($$result, "MainLayout", $$MainLayout, { "title": "Shop | Kersivo Barber Outreach" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="container shop-page"> <header class="shop-header"> <p class="shop-eyebrow">Demo shop</p> <h1>Products</h1> <p class="muted">Add products to cart and confirm pickup orders in GBP.</p> </header> <section class="shop-grid" aria-label="Products"> ${products.length === 0 ? renderTemplate`<article class="shop-card"> <h2>No products yet</h2> <p class="muted">Products added in Admin → Shop will appear here.</p> </article>` : products.map((product) => renderTemplate`<article class="shop-card"${addAttribute(product.id, "key")}> ${product.imageUrl ? renderTemplate`<img${addAttribute(product.imageUrl, "src")}${addAttribute(product.name, "alt")} class="shop-image" loading="lazy">` : null} <div class="shop-card-body"> <div class="shop-card-head"> <h2>${product.name}</h2> <p class="shop-price">${formatGbp(product.pricePence)}</p> </div> ${product.description ? renderTemplate`<p class="muted">${product.description}</p>` : null} <button type="button" class="btn btn--primary" data-add-to-cart${addAttribute(product.id, "data-product-id")}${addAttribute(product.name, "data-product-name")}${addAttribute(String(product.pricePence), "data-product-price-pence")}${addAttribute(product.imageUrl ?? "", "data-product-image-url")}>
Add to cart
</button> </div> </article>`)} </section> </main> ` })}`;
}, "C:/dev/kersivo-barber-outreach/src/pages/shop.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/shop.astro";
const $$url = "/shop";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Shop,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
