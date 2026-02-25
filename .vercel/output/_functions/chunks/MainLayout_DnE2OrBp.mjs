import { e as createComponent, r as renderTemplate, g as addAttribute, m as maybeRenderHead, h as createAstro, k as renderComponent, v as renderHead, x as renderSlot } from './astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import 'clsx';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { useEffect, useSyncExternalStore } from 'react';
/* empty css                         */
/* empty css                         */
/* empty css                         */
/* empty css                         */

var __freeze$1 = Object.freeze;
var __defProp$1 = Object.defineProperty;
var __template$1 = (cooked, raw) => __freeze$1(__defProp$1(cooked, "raw", { value: __freeze$1(cooked.slice()) }));
var _a$1;
const $$Astro$1 = createAstro();
const $$NavbarCartButton = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$NavbarCartButton;
  const { class: className = "" } = Astro2.props;
  return renderTemplate(_a$1 || (_a$1 = __template$1(["", '<button type="button"', ` aria-label="Open cart" data-navbar-cart-button> <span aria-hidden="true">\u{1F6D2}</span> <span>Cart</span> <span class="navbar17__cart-badge is-empty" data-navbar-cart-badge>0</span> </button> <script type="module">
  import { getItemCount, openCart, subscribe } from '@/lib/shop/cartStore';

  const kersivoWindow = window as Window & { __KERSIVO_NAVBAR_CART_SYNC__?: boolean };

  const renderCount = (count: number) => {
    const badges = Array.from(document.querySelectorAll('[data-navbar-cart-badge]'));

    badges.forEach((badge) => {
      badge.textContent = String(count);
      badge.classList.toggle('is-empty', count === 0);
    });
  };

  const bindCartButtons = () => {
    const cartButtons = Array.from(document.querySelectorAll('[data-navbar-cart-button]'));

    cartButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement && button.dataset.cartSyncBound !== 'true') {
        button.dataset.cartSyncBound = 'true';
        button.addEventListener('click', () => {
          openCart();
        });
      }
    });
  };

  bindCartButtons();
  renderCount(getItemCount());

  if (!kersivoWindow.__KERSIVO_NAVBAR_CART_SYNC__) {
    kersivoWindow.__KERSIVO_NAVBAR_CART_SYNC__ = true;
    subscribe(() => {
      bindCartButtons();
      renderCount(getItemCount());
    });
  }
<\/script>`])), maybeRenderHead(), addAttribute(className, "class"));
}, "C:/dev/kersivo-barber-outreach/src/components/shop/NavbarCartButton.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$Navbar17 = createComponent(($$result, $$props, $$slots) => {
  const navLogo = {
    url: "#",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-icon.svg",
    alt: "Kersivo logo",
    title: "Kersivo"
  };
  const navItems = [
    { name: "Home", link: "#" },
    { name: "Services", link: "#" },
    { name: "Pricing", link: "#" },
    { name: "Contact", link: "#" }
  ];
  return renderTemplate(_a || (_a = __template(["", '<header class="navbar17" data-navbar17> <div class="container navbar17__wrap"> <a', ' class="navbar17__brand" aria-label="Kersivo home"> <img', "", ' width="32" height="32" loading="lazy"> <span>', '</span> </a> <nav class="navbar17__desktop" aria-label="Primary"> <ul class="navbar17__list" data-nav-list> ', ' <span class="navbar17__indicator" data-nav-indicator aria-hidden="true"></span> </ul> </nav> <div class="navbar17__actions"> ', ' <a href="#" class="btn btn--secondary">Sign Up</a> </div> <button class="navbar17__toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-nav-toggle> <span class="navbar17__toggle-icon" aria-hidden="true"></span> <span class="sr-only">Toggle navigation menu</span> </button> </div> <nav id="mobile-menu" class="navbar17__mobile" aria-label="Mobile primary" data-mobile-nav hidden> <ul> ', ' <li class="navbar17__mobile-cart-wrap"> ', ` </li> <li class="navbar17__mobile-cta-wrap"> <a href="#" class="btn btn--secondary navbar17__mobile-cta">Sign Up</a> </li> </ul> </nav> </header> <script type="module">
  const navbar = document.querySelector('[data-navbar17]');

  if (navbar) {
    const links = Array.from(navbar.querySelectorAll('[data-nav-item]'));
    const mobileLinks = Array.from(navbar.querySelectorAll('[data-mobile-item]'));
    const indicator = navbar.querySelector('[data-nav-indicator]');
    const navList = navbar.querySelector('[data-nav-list]');
    const toggle = navbar.querySelector('[data-nav-toggle]');
    const mobileNav = navbar.querySelector('[data-mobile-nav]');

    const setActive = (name) => {
      links.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.navName === name);
      });

      mobileLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.navName === name);
      });
      const activeDesktop = links.find((link) => link.classList.contains('is-active'));

      if (activeDesktop instanceof HTMLElement && indicator instanceof HTMLElement && navList instanceof HTMLElement) {
        const listRect = navList.getBoundingClientRect();
        const activeRect = activeDesktop.getBoundingClientRect();

        indicator.style.width = \`\${activeRect.width}px\`;
        indicator.style.transform = \`translateX(\${activeRect.left - listRect.left}px)\`;
      }
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        setActive(link.dataset.navName || '');
      });
    });

    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        setActive(link.dataset.navName || '');
        if (toggle instanceof HTMLButtonElement && mobileNav instanceof HTMLElement) {
          toggle.setAttribute('aria-expanded', 'false');
          mobileNav.hidden = true;
        }
      });
    });

    if (toggle instanceof HTMLButtonElement && mobileNav instanceof HTMLElement) {
      toggle.addEventListener('click', () => {
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isOpen));
        mobileNav.hidden = isOpen;
      });
    }

    window.addEventListener('resize', () => {
      const activeDesktop = links.find((link) => link.classList.contains('is-active'));
      if (activeDesktop) {
        setActive(activeDesktop.dataset.navName || '');
      }
    });

    setActive(links[0]?.dataset.navName || '');
  }
<\/script>`], ["", '<header class="navbar17" data-navbar17> <div class="container navbar17__wrap"> <a', ' class="navbar17__brand" aria-label="Kersivo home"> <img', "", ' width="32" height="32" loading="lazy"> <span>', '</span> </a> <nav class="navbar17__desktop" aria-label="Primary"> <ul class="navbar17__list" data-nav-list> ', ' <span class="navbar17__indicator" data-nav-indicator aria-hidden="true"></span> </ul> </nav> <div class="navbar17__actions"> ', ' <a href="#" class="btn btn--secondary">Sign Up</a> </div> <button class="navbar17__toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-nav-toggle> <span class="navbar17__toggle-icon" aria-hidden="true"></span> <span class="sr-only">Toggle navigation menu</span> </button> </div> <nav id="mobile-menu" class="navbar17__mobile" aria-label="Mobile primary" data-mobile-nav hidden> <ul> ', ' <li class="navbar17__mobile-cart-wrap"> ', ` </li> <li class="navbar17__mobile-cta-wrap"> <a href="#" class="btn btn--secondary navbar17__mobile-cta">Sign Up</a> </li> </ul> </nav> </header> <script type="module">
  const navbar = document.querySelector('[data-navbar17]');

  if (navbar) {
    const links = Array.from(navbar.querySelectorAll('[data-nav-item]'));
    const mobileLinks = Array.from(navbar.querySelectorAll('[data-mobile-item]'));
    const indicator = navbar.querySelector('[data-nav-indicator]');
    const navList = navbar.querySelector('[data-nav-list]');
    const toggle = navbar.querySelector('[data-nav-toggle]');
    const mobileNav = navbar.querySelector('[data-mobile-nav]');

    const setActive = (name) => {
      links.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.navName === name);
      });

      mobileLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.navName === name);
      });
      const activeDesktop = links.find((link) => link.classList.contains('is-active'));

      if (activeDesktop instanceof HTMLElement && indicator instanceof HTMLElement && navList instanceof HTMLElement) {
        const listRect = navList.getBoundingClientRect();
        const activeRect = activeDesktop.getBoundingClientRect();

        indicator.style.width = \\\`\\\${activeRect.width}px\\\`;
        indicator.style.transform = \\\`translateX(\\\${activeRect.left - listRect.left}px)\\\`;
      }
    };

    links.forEach((link) => {
      link.addEventListener('click', () => {
        setActive(link.dataset.navName || '');
      });
    });

    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        setActive(link.dataset.navName || '');
        if (toggle instanceof HTMLButtonElement && mobileNav instanceof HTMLElement) {
          toggle.setAttribute('aria-expanded', 'false');
          mobileNav.hidden = true;
        }
      });
    });

    if (toggle instanceof HTMLButtonElement && mobileNav instanceof HTMLElement) {
      toggle.addEventListener('click', () => {
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isOpen));
        mobileNav.hidden = isOpen;
      });
    }

    window.addEventListener('resize', () => {
      const activeDesktop = links.find((link) => link.classList.contains('is-active'));
      if (activeDesktop) {
        setActive(activeDesktop.dataset.navName || '');
      }
    });

    setActive(links[0]?.dataset.navName || '');
  }
<\/script>`])), maybeRenderHead(), addAttribute(navLogo.url, "href"), addAttribute(navLogo.src, "src"), addAttribute(navLogo.alt, "alt"), navLogo.title, navItems.map((item, index) => renderTemplate`<li> <a${addAttribute(item.link, "href")}${addAttribute(`navbar17__link ${index === 0 ? "is-active" : ""}`, "class")} data-nav-item${addAttribute(item.name, "data-nav-name")}> ${item.name} </a> </li>`), renderComponent($$result, "NavbarCartButton", $$NavbarCartButton, { "class": "navbar17__cart-btn" }), navItems.map((item, index) => renderTemplate`<li> <a${addAttribute(item.link, "href")}${addAttribute(`navbar17__mobile-link ${index === 0 ? "is-active" : ""}`, "class")} data-mobile-item${addAttribute(item.name, "data-nav-name")}> ${item.name} </a> </li>`), renderComponent($$result, "NavbarCartButton", $$NavbarCartButton, { "class": "navbar17__cart-btn navbar17__cart-btn--mobile" }));
}, "C:/dev/kersivo-barber-outreach/src/components/navbar17.astro", void 0);

const CART_STORAGE_KEY = "kersivo_shop_cart_v2";
const SERVER_SNAPSHOT = Object.freeze({
  items: [],
  isOpen: false,
  subtotalPence: 0,
  email: ""
});
const store = globalThis.__KERSIVO_CART_STORE__ ?? {
  state: {
    items: [],
    isOpen: false,
    email: ""
  },
  clientSnapshot: SERVER_SNAPSHOT,
  listeners: /* @__PURE__ */ new Set(),
  isHydrated: false,
  storageListenerBound: false
};
globalThis.__KERSIVO_CART_STORE__ = store;
function emitChange() {
  store.clientSnapshot = {
    items: store.state.items,
    isOpen: store.state.isOpen,
    subtotalPence: store.state.items.reduce((sum, item) => sum + item.pricePence * item.quantity, 0),
    email: store.state.email
  };
  for (const listener of store.listeners) {
    listener();
  }
}
function toSafeItem(item) {
  const productId = String(item.productId ?? "").trim();
  const name = String(item.name ?? "").trim();
  const pricePence = Math.max(0, Math.floor(Number(item.pricePence ?? 0)));
  const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
  if (!productId || !name) {
    return null;
  }
  return {
    productId,
    name,
    pricePence,
    imageUrl: item.imageUrl ? String(item.imageUrl) : void 0,
    quantity
  };
}
function readFromStorage() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => toSafeItem(item)).filter((item) => Boolean(item));
  } catch {
    return [];
  }
}
function writeToStorage(items) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}
function ensureHydrated() {
  if (typeof window === "undefined" || store.isHydrated) {
    return;
  }
  store.state.items = readFromStorage();
  store.isHydrated = true;
  emitChange();
  if (!store.storageListenerBound) {
    window.addEventListener("storage", (event) => {
      if (event.key !== CART_STORAGE_KEY) {
        return;
      }
      store.state.items = readFromStorage();
      emitChange();
    });
    store.storageListenerBound = true;
  }
}
function updateItems(nextItems) {
  store.state.items = nextItems;
  writeToStorage(store.state.items);
  emitChange();
}
function subscribe(listener) {
  ensureHydrated();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}
function getSnapshot() {
  ensureHydrated();
  return store.clientSnapshot;
}
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}
function addItem(input) {
  ensureHydrated();
  const safeProductId = String(input.productId).trim();
  const safeName = String(input.name).trim();
  const safePrice = Math.max(0, Math.floor(Number(input.pricePence)));
  const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1)));
  if (!safeProductId || !safeName) {
    return;
  }
  const existingIndex = store.state.items.findIndex((item) => item.productId === safeProductId);
  if (existingIndex === -1) {
    updateItems([
      ...store.state.items,
      {
        productId: safeProductId,
        name: safeName,
        pricePence: safePrice,
        imageUrl: input.imageUrl,
        quantity
      }
    ]);
    return;
  }
  const nextItems = [...store.state.items];
  nextItems[existingIndex] = {
    ...nextItems[existingIndex],
    name: safeName,
    pricePence: safePrice,
    imageUrl: input.imageUrl ?? nextItems[existingIndex].imageUrl,
    quantity: nextItems[existingIndex].quantity + quantity
  };
  updateItems(nextItems);
}
function removeItem(productId) {
  ensureHydrated();
  updateItems(store.state.items.filter((item) => item.productId !== productId));
}
function setQuantity(productId, quantity) {
  ensureHydrated();
  const nextQuantity = Math.floor(Number(quantity));
  const nextItems = [...store.state.items];
  const itemIndex = nextItems.findIndex((item) => item.productId === productId);
  if (itemIndex === -1) {
    return;
  }
  if (nextQuantity <= 0) {
    nextItems.splice(itemIndex, 1);
    updateItems(nextItems);
    return;
  }
  nextItems[itemIndex] = {
    ...nextItems[itemIndex],
    quantity: nextQuantity
  };
  updateItems(nextItems);
}
function openCart() {
  ensureHydrated();
  store.state.isOpen = true;
  emitChange();
}
function closeCart() {
  ensureHydrated();
  store.state.isOpen = false;
  emitChange();
}

function useCartSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
function formatGbp(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}
function getProductFromButton(button) {
  const productId = button.dataset.productId?.trim();
  const name = button.dataset.productName?.trim();
  const pricePence = Number(button.dataset.productPricePence);
  const imageUrl = button.dataset.productImageUrl?.trim();
  if (!productId || !name || Number.isNaN(pricePence)) {
    return null;
  }
  return {
    productId,
    name,
    pricePence: Math.max(0, Math.floor(pricePence)),
    imageUrl: imageUrl || void 0,
    quantity: 1
  };
}
function CartDrawer() {
  const { items, subtotalPence, isOpen: open } = useCartSnapshot();
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);
  useEffect(() => {
    const onDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const addToCartButton = target.closest("[data-add-to-cart]");
      if (!addToCartButton || !(addToCartButton instanceof HTMLElement)) {
        return;
      }
      const product = getProductFromButton(addToCartButton);
      if (!product) {
        return;
      }
      addItem(product);
      openCart();
    };
    document.addEventListener("click", onDocumentClick);
    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("aside", { className: `cart-drawer ${open ? "cart-drawer--open" : ""}`, "aria-hidden": open ? "false" : "true", children: [
      /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost cart-drawer__close", onClick: closeCart, children: "Close" }),
      /* @__PURE__ */ jsx("h2", { children: "Cart" }),
      /* @__PURE__ */ jsx("div", { className: "cart-items", children: items.length === 0 ? /* @__PURE__ */ jsx("p", { className: "muted", children: "Your cart is empty." }) : items.map((item) => /* @__PURE__ */ jsxs("article", { className: "cart-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "cart-row__content", children: [
          item.imageUrl ? /* @__PURE__ */ jsx("img", { src: item.imageUrl, alt: item.name, className: "cart-row__image", loading: "lazy" }) : null,
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "cart-item-name", children: item.name }),
            /* @__PURE__ */ jsxs("p", { className: "muted", children: [
              formatGbp(item.pricePence),
              " each"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "cart-row-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => setQuantity(item.productId, item.quantity - 1), children: "-" }),
          /* @__PURE__ */ jsx("span", { children: item.quantity }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--ghost", onClick: () => setQuantity(item.productId, item.quantity + 1), children: "+" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--secondary", onClick: () => removeItem(item.productId), children: "Remove" })
        ] })
      ] }, item.productId)) }),
      /* @__PURE__ */ jsx("label", { className: "cart-email-label", htmlFor: "shop-cart-email", children: "Email for receipt" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          id: "shop-cart-email",
          type: "email",
          autoComplete: "email",
          placeholder: "you@example.com",
          className: "cart-email-input"
        }
      ),
      /* @__PURE__ */ jsxs("p", { className: "cart-subtotal", children: [
        "Subtotal: ",
        /* @__PURE__ */ jsx("strong", { children: formatGbp(subtotalPence) })
      ] })
    ] }),
    open ? /* @__PURE__ */ jsx("button", { type: "button", className: "cart-drawer__backdrop", "aria-label": "Close cart drawer", onClick: closeCart }) : null,
    /* @__PURE__ */ jsxs("span", { className: "cart-count-announcer", "aria-live": "polite", "aria-atomic": "true", children: [
      "Cart has ",
      cartCount,
      " item",
      cartCount === 1 ? "" : "s",
      "."
    ] })
  ] });
}

const $$CartDrawerMount = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "CartDrawer", CartDrawer, { "client:load": true, "client:component-hydration": "load", "client:component-path": "C:/dev/kersivo-barber-outreach/src/components/shop/CartDrawer", "client:component-export": "default" })}`;
}, "C:/dev/kersivo-barber-outreach/src/components/shop/CartDrawerMount.astro", void 0);

const $$Astro = createAstro();
const $$MainLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$MainLayout;
  const { title } = Astro2.props;
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" href="/favicon.ico"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>${title}</title>${renderHead()}</head> <body> ${renderComponent($$result, "Navbar17", $$Navbar17, {})} ${renderSlot($$result, $$slots["default"])} ${renderComponent($$result, "CartDrawerMount", $$CartDrawerMount, {})} </body></html>`;
}, "C:/dev/kersivo-barber-outreach/src/layouts/MainLayout.astro", void 0);

export { $$MainLayout as $ };
