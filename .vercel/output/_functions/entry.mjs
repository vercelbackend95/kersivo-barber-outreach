import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_Bf46eGuz.mjs';
import { manifest } from './manifest_B8w32DBg.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/admin.astro.mjs');
const _page2 = () => import('./pages/api/admin/availability.astro.mjs');
const _page3 = () => import('./pages/api/admin/barbers.astro.mjs');
const _page4 = () => import('./pages/api/admin/bookings/cancel.astro.mjs');
const _page5 = () => import('./pages/api/admin/bookings/manual.astro.mjs');
const _page6 = () => import('./pages/api/admin/bookings.astro.mjs');
const _page7 = () => import('./pages/api/admin/clients/_clientid_/notes.astro.mjs');
const _page8 = () => import('./pages/api/admin/clients/_clientid_.astro.mjs');
const _page9 = () => import('./pages/api/admin/clients.astro.mjs');
const _page10 = () => import('./pages/api/admin/login.astro.mjs');
const _page11 = () => import('./pages/api/admin/logout.astro.mjs');
const _page12 = () => import('./pages/api/admin/reports.astro.mjs');
const _page13 = () => import('./pages/api/admin/services.astro.mjs');
const _page14 = () => import('./pages/api/admin/session.astro.mjs');
const _page15 = () => import('./pages/api/admin/shop/orders/_id_/collect.astro.mjs');
const _page16 = () => import('./pages/api/admin/shop/orders/_id_.astro.mjs');
const _page17 = () => import('./pages/api/admin/shop/orders.astro.mjs');
const _page18 = () => import('./pages/api/admin/shop/products/create.astro.mjs');
const _page19 = () => import('./pages/api/admin/shop/products/delete.astro.mjs');
const _page20 = () => import('./pages/api/admin/shop/products/toggle.astro.mjs');
const _page21 = () => import('./pages/api/admin/shop/products/update.astro.mjs');
const _page22 = () => import('./pages/api/admin/shop/products.astro.mjs');
const _page23 = () => import('./pages/api/admin/shop/sales/demo.astro.mjs');
const _page24 = () => import('./pages/api/admin/shop/sales.astro.mjs');
const _page25 = () => import('./pages/api/admin/timeblocks/create.astro.mjs');
const _page26 = () => import('./pages/api/admin/timeblocks/delete.astro.mjs');
const _page27 = () => import('./pages/api/admin/timeblocks.astro.mjs');
const _page28 = () => import('./pages/api/admin/timeoff.astro.mjs');
const _page29 = () => import('./pages/api/availability.astro.mjs');
const _page30 = () => import('./pages/api/bookings/cancel.astro.mjs');
const _page31 = () => import('./pages/api/bookings/confirm.astro.mjs');
const _page32 = () => import('./pages/api/bookings/create.astro.mjs');
const _page33 = () => import('./pages/api/bookings/reschedule.astro.mjs');
const _page34 = () => import('./pages/api/shop/checkout.astro.mjs');
const _page35 = () => import('./pages/api/shop/order-by-session.astro.mjs');
const _page36 = () => import('./pages/api/shop/webhook.astro.mjs');
const _page37 = () => import('./pages/book/cancel.astro.mjs');
const _page38 = () => import('./pages/book/confirm.astro.mjs');
const _page39 = () => import('./pages/book/reschedule.astro.mjs');
const _page40 = () => import('./pages/book.astro.mjs');
const _page41 = () => import('./pages/shop/cancelled.astro.mjs');
const _page42 = () => import('./pages/shop/success.astro.mjs');
const _page43 = () => import('./pages/shop.astro.mjs');
const _page44 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/admin.astro", _page1],
    ["src/pages/api/admin/availability.ts", _page2],
    ["src/pages/api/admin/barbers.ts", _page3],
    ["src/pages/api/admin/bookings/cancel.ts", _page4],
    ["src/pages/api/admin/bookings/manual.ts", _page5],
    ["src/pages/api/admin/bookings.ts", _page6],
    ["src/pages/api/admin/clients/[clientId]/notes.ts", _page7],
    ["src/pages/api/admin/clients/[clientId]/index.ts", _page8],
    ["src/pages/api/admin/clients.ts", _page9],
    ["src/pages/api/admin/login.ts", _page10],
    ["src/pages/api/admin/logout.ts", _page11],
    ["src/pages/api/admin/reports.ts", _page12],
    ["src/pages/api/admin/services.ts", _page13],
    ["src/pages/api/admin/session.ts", _page14],
    ["src/pages/api/admin/shop/orders/[id]/collect.ts", _page15],
    ["src/pages/api/admin/shop/orders/[id]/index.ts", _page16],
    ["src/pages/api/admin/shop/orders/index.ts", _page17],
    ["src/pages/api/admin/shop/products/create.ts", _page18],
    ["src/pages/api/admin/shop/products/delete.ts", _page19],
    ["src/pages/api/admin/shop/products/toggle.ts", _page20],
    ["src/pages/api/admin/shop/products/update.ts", _page21],
    ["src/pages/api/admin/shop/products/index.ts", _page22],
    ["src/pages/api/admin/shop/sales/demo.ts", _page23],
    ["src/pages/api/admin/shop/sales/index.ts", _page24],
    ["src/pages/api/admin/timeblocks/create.ts", _page25],
    ["src/pages/api/admin/timeblocks/delete.ts", _page26],
    ["src/pages/api/admin/timeblocks/index.ts", _page27],
    ["src/pages/api/admin/timeoff.ts", _page28],
    ["src/pages/api/availability.ts", _page29],
    ["src/pages/api/bookings/cancel.ts", _page30],
    ["src/pages/api/bookings/confirm.ts", _page31],
    ["src/pages/api/bookings/create.ts", _page32],
    ["src/pages/api/bookings/reschedule.ts", _page33],
    ["src/pages/api/shop/checkout.ts", _page34],
    ["src/pages/api/shop/order-by-session.ts", _page35],
    ["src/pages/api/shop/webhook.ts", _page36],
    ["src/pages/book/cancel.astro", _page37],
    ["src/pages/book/confirm.astro", _page38],
    ["src/pages/book/reschedule.astro", _page39],
    ["src/pages/book/index.astro", _page40],
    ["src/pages/shop/cancelled.astro", _page41],
    ["src/pages/shop/success.astro", _page42],
    ["src/pages/shop.astro", _page43],
    ["src/pages/index.astro", _page44]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "1ea8e53f-9835-4309-969f-f464deb69dc5",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
