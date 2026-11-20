// KERSIVO demo bridge for Heritage Grooming.
//
// The site's own booking and shop forms stay exactly as they are; this file is what happens after they
// are sent. It plays the part of the KERSIVO booking backend for the live demo:
//   • availability comes from the demo owner dashboard (GET /api/demo/heritage/admin/bookings?date=…),
//     so a time that is taken on the dashboard timeline is not offered here;
//   • a booking or a reservation is kept in this browser (localStorage, 24 hours) in the row format the
//     dashboard reads, so it appears on /demo/heritage-grooming/admin with a "YOUR DEMO BOOKING" tag.
// Nothing is sent to the shop, no appointment is created and no payment is taken.
//
// Keep in step with: src/lib/demo/demoTenantStore.ts (keys), src/lib/demo/blacklineSessionBookings.ts and
// src/lib/demo/blacklineSessionOrders.ts (row shape and validation), src/lib/demo/heritage/data.ts (ids).

import { BARBERS, MENU } from './data.js';
import { byId, imgOf, labelOf } from './shop-data.js';

const API = '/api/demo/heritage/admin';
const BOOKINGS_KEY = 'kersivo.heritage.demo-bookings.v1';
const ORDERS_KEY = 'kersivo.heritage.demo-orders.v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const SOURCE = 'blackline-demo-session';
const TZ = 'Europe/London';
const SITE_ROOT = '/demo/heritage-grooming/';
const ADMIN = '/demo/heritage-grooming/admin';

// Deep links the owner dashboard understands: it opens the right day or order and highlights the visitor's row.
function dashboardLink(params) {
  return `${ADMIN}?${new URLSearchParams(params).toString()}`;
}
const NO_EMAIL = 'No email given';

const barberId = (siteId) => `hg-barber-${siteId}`;
const serviceId = (siteId) => `hg-svc-${siteId}`;
const productId = (siteId) => `hg-product-${siteId}`;
const pence = (pounds) => Math.round(pounds * 100);

/* ───────────── storage ───────────── */

function read(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(rows)) return [];
    const now = Date.now();
    return rows.filter((row) => row && now - Date.parse(row.createdAt) <= TTL_MS);
  } catch { return []; }
}

function write(key, rows) {
  try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* private window: the dashboard just will not see it */ }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `hg-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const reference = () => `HG-${Math.floor(1000 + Math.random() * 9000)}`;

/* ───────────── London time ───────────── */

const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hhmmOf = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// The instant at which the shop's clock in London reads `day` `minutes`.
function londonInstant(day, minutes) {
  const [y, mo, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const p = Object.fromEntries(londonParts.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (wall - guess)).toISOString();
}

// Minutes after midnight on the London clock for an ISO instant on `day`, or null on another day.
function londonMinutes(iso, day) {
  const p = Object.fromEntries(londonParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  if (`${p.year}-${p.month}-${p.day}` !== day) return null;
  return +p.hour * 60 + +p.minute;
}

/* ───────────── availability ───────────── */

const busyCache = new Map();

// Every chair that is taken on `day`: the dashboard's bookings plus the visitor's own demo bookings.
async function busyOn(day) {
  if (!busyCache.has(day)) {
    busyCache.set(day, fetch(`${API}/bookings?date=${day}`, { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : { bookings: [] }))
      .then((body) => (Array.isArray(body.bookings) ? body.bookings : []))
      .catch(() => []));
  }
  const fixtures = (await busyCache.get(day))
    .filter((row) => row.status !== 'CANCELLED_BY_CLIENT' && row.status !== 'CANCELLED_BY_SHOP')
    .map((row) => ({ barberId: row.barberId, start: londonMinutes(row.startAt, day), end: londonMinutes(row.endAt, day) }));
  const own = read(BOOKINGS_KEY)
    .filter((row) => row.date === day)
    .map((row) => ({ barberId: row.barberId, start: minutesOf(row.startTime), end: minutesOf(row.startTime) + row.durationMinutes }));
  return [...fixtures, ...own].filter((row) => row.start != null && row.end != null);
}

const free = (busy, barber, start, end) =>
  !busy.some((row) => row.barberId === barberId(barber.id) && row.start < end && row.end > start);

const workingOn = (date) => BARBERS.filter((b) => b.days.includes(date.getDay()));

// The site's own slot list for the day, less the times every suitable barber is already booked.
export async function freeSlots(date, service, barber, slots) {
  if (!slots.length) return slots;
  const busy = await busyOn(isoDay(date));
  const chairs = barber ? [barber] : workingOn(date);
  return slots.filter((time) => {
    const start = minutesOf(time);
    return chairs.some((b) => free(busy, b, start, start + service.mins));
  });
}

/* ───────────── bookings ───────────── */

// BOOKING.submit(payload) from booking.js. "Any barber" goes to the first one free at that time.
export async function saveBooking(payload) {
  const date = new Date(`${payload.date}T12:00:00`);
  const start = minutesOf(payload.time);
  const menu = MENU.find((s) => s.id === payload.service.id) ?? payload.service;
  const busy = await busyOn(payload.date);
  const chosen = payload.barber
    ? BARBERS.find((b) => b.id === payload.barber.id)
    : workingOn(date).find((b) => free(busy, b, start, start + menu.mins));
  if (!chosen) throw new Error('No barber free at that time.');
  if (!free(busy, chosen, start, start + menu.mins)) throw new Error('That time has just gone.');

  const now = new Date().toISOString();
  const row = {
    id: uid(),
    reference: reference(),
    serviceId: serviceId(menu.id),
    serviceName: menu.name,
    durationMinutes: menu.mins,
    pricePence: pence(menu.price),
    barberId: barberId(chosen.id),
    barberName: chosen.name,
    fullName: payload.customer.name,
    email: payload.customer.email || NO_EMAIL,
    phone: payload.customer.phone || null,
    date: payload.date,
    startTime: hhmmOf(start),
    startAt: londonInstant(payload.date, start),
    endAt: londonInstant(payload.date, start + menu.mins),
    status: 'BOOKED',
    createdAt: now,
    source: SOURCE,
  };
  write(BOOKINGS_KEY, [...read(BOOKINGS_KEY), row]);
  return {
    demo: true,
    kersivo: true,
    reference: row.reference,
    barber: chosen.name,
    dashboardHref: dashboardLink({ section: 'bookings_dashboard', bookingId: row.id, bookingDate: row.date, demoJourney: 'booking' }),
  };
}

/* ───────────── shop reservations ───────────── */

// BAG.submit(order) from shop.js: { name, phone, day, lines: [{ id, qty }], total }.
export function saveOrder(order) {
  const items = order.lines
    .map((line, index) => {
      const p = byId(line.id);
      if (!p || !(line.qty > 0)) return null;
      return {
        id: `hg-session-item-${index + 1}`,
        productId: productId(p.id),
        name: labelOf(p),
        unitPricePence: pence(p.price),
        quantity: line.qty,
        lineTotalPence: pence(p.price) * line.qty,
        imageUrl: SITE_ROOT + imgOf(p),
      };
    })
    .filter(Boolean);
  if (!items.length) return { ok: false, message: 'Your bag is empty.' };

  const now = new Date().toISOString();
  const subtotal = items.reduce((n, item) => n + item.lineTotalPence, 0);
  const row = {
    id: uid(),
    reference: reference(),
    customerName: order.name,
    customerEmail: NO_EMAIL,
    items,
    subtotalPence: subtotal,
    totalPence: subtotal,
    currency: 'GBP',
    status: 'PAID',
    collectionMethod: 'Collect in shop',
    createdAt: now,
    paidAt: now,
    collectedAt: null,
    source: SOURCE,
  };
  write(ORDERS_KEY, [...read(ORDERS_KEY), row]);
  return {
    ok: true,
    preview: true,
    kersivo: true,
    reference: row.reference,
    order,
    dashboardHref: dashboardLink({ section: 'shop_orders', order: row.id, demoJourney: 'retail' }),
  };
}
