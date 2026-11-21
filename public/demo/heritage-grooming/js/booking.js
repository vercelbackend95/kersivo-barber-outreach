// Booking flow: service and barber → day and time → details. Front end only.
//
// ── Connecting Kersivo (or any booking backend) ─────────────────────────────
// Everything the visitor chose arrives in one object at BOOKING.submit(payload):
//   { service: { id, name, mins, price }, barber: { id, name } | null (any barber),
//     date: 'YYYY-MM-DD', time: 'HH:MM', customer: { name, phone, email, notes } }
// Replace the body of BOOKING.submit with the Kersivo call (or a redirect to the
// Kersivo booking page) and return a promise. Resolve to show the confirmation,
// reject to show the error line. BOOKING.slots(date, service, barber) is the second
// seam: return real availability from there. Until then nothing is sent anywhere.
// The same payload is also dispatched as a `heritage:booking` event on window.
//
// Other scripts steer the form with events on document:
//   booking:select  { id }  – a service, opens the times
//   booking:barber  { id }  – a barber ('' or null = any barber), stays on step 1 until a service is chosen
// <div data-booking data-menu="full"> offers the whole price list (data.js MENU), grouped by chapter.

import { SERVICES, MENU, CATEGORIES, BARBERS, daysText } from './data.js';
import { frameAll } from './brass-frame.js';
import { HOURS } from './house.js';
import { freeSlots, saveBooking } from './kersivo.js';

export const BOOKING = {
  currency: '£',
  locale: 'en-GB',
  daysAhead: 14,
  slotEvery: 30,                                   // minutes
  // opening hours by weekday (0 = Sunday); null = closed. One list for the whole site: house.js HOURS
  hours: HOURS,

  async slots(date, service, barber) {
    const span = this.hours[date.getDay()];
    if (!span || (barber && !barber.days.includes(date.getDay()))) return [];
    const out = [];
    const now = new Date();
    for (let m = span[0] * 60; m + service.mins <= span[1] * 60; m += this.slotEvery) {
      const at = new Date(date); at.setHours(0, m, 0, 0);
      if (at - now < 30 * 60 * 1000) continue;     // nothing in the past or in the next half hour
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    // KERSIVO demo: drop the times already taken on the owner dashboard (js/kersivo.js).
    return freeSlots(date, service, barber, out);
  },

  async submit(payload) {
    // KERSIVO demo: the booking shows on /demo/heritage-grooming/admin (js/kersivo.js). Nothing reaches the shop.
    return saveBooking(payload);
  },
};

const root = document.querySelector('[data-booking]');
if (root) init(root);

// A second, self-contained copy of the flow (the booking sheet, js/book-sheet.js) mounts with
// { global: false, ns: 'sheet-' }: its own radio names and ids, its own stepper (host), no document events.
export function mountBooking(root, opts) { return init(root, opts); }

function init(root, { global = true, ns = '', host = root.closest('.book') ?? document, menu = root.dataset.menu, onChange = null } = {}) {
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = () => (reduce ? null : window.gsap);

  // services come from the price list when the page prints one, so there is one source of truth there
  const printed = [...document.querySelectorAll('.svc[data-service]')].map((el) => ({
    id: el.dataset.service, name: el.dataset.name, mins: +el.dataset.mins, price: +el.dataset.price,
    desc: el.querySelector('.svc__desc')?.textContent ?? '',
  }));
  const services = printed.length ? printed : [...(menu === 'full' ? MENU : SERVICES)];

  const state = { step: 1, service: null, barber: null, date: null, time: null };
  const steps = $$('[data-step]');
  const nextBtn = $('[data-next]'), backBtn = $('[data-back]'), nextLabel = $('[data-next-label]');
  const nav = $('[data-booknav]');
  const stepperBtns = [...host.querySelectorAll('.stepper__btn')];
  const sum = Object.fromEntries($$('[data-sum]').map((el) => [el.dataset.sum, el]));
  const empty = { service: sum.service.textContent, barber: sum.barber?.textContent ?? '', day: sum.day.textContent, time: sum.time.textContent };

  const fmtDay = new Intl.DateTimeFormat(BOOKING.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDow = new Intl.DateTimeFormat(BOOKING.locale, { weekday: 'short' });
  const fmtMon = new Intl.DateTimeFormat(BOOKING.locale, { month: 'short' });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /* ── step 1: services ── */
  const choices = $('[data-services]');
  const choiceHtml = (s) => `
    <label class="choice">
      <input type="radio" name="${ns}service" value="${s.id}">
      <span class="choice__box">
        <span class="choice__name">${s.name}</span><span class="choice__price">${BOOKING.currency}${s.price}</span>
        <span class="choice__meta">${s.mins} min · ${s.desc}</span>
      </span>
    </label>`;
  const grouped = services.some((s) => s.cat);
  choices.innerHTML = grouped
    ? CATEGORIES.map((c) => `<p class="choices__cat">${c.name}</p>${services.filter((s) => s.cat === c.id).map(choiceHtml).join('')}`).join('')
    : services.map(choiceHtml).join('');
  choices.addEventListener('change', (e) => pickService(e.target.value));

  function pickService(id) {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    const changed = state.service?.id !== s.id;
    state.service = s;
    const input = choices.querySelector(`input[value="${id}"]`);
    if (input) input.checked = true;
    if (changed && state.time) { state.time = null; }      // a longer service may not fit the old slot
    render();
    if (state.date) renderSlots();
  }

  /* ── step 1: barber (optional; "Any barber" is the default) ── */
  const barbersEl = $('[data-barbers]');
  if (barbersEl) {
    barbersEl.innerHTML = [{ id: '', name: 'Any barber', role: 'The first free chair', days: [2, 3, 4, 5, 6] }, ...BARBERS].map((b) => `
      <label class="pick">
        <input type="radio" name="${ns}barber" value="${b.id}" ${b.id ? '' : 'checked'}>
        <span class="pick__box">
          ${b.photo
            ? `<span class="pick__face"><img class="pick__img" src="${b.photo}-500.webp" width="500" height="670" alt="" loading="lazy" decoding="async" data-source="stand-in" data-subject="stand-in"></span>`
            : '<span class="pick__face pick__face--any" aria-hidden="true"><img src="assets/img/seal.webp" width="660" height="660" alt=""></span>'}
          <span class="pick__name">${b.name}</span>
          <span class="pick__meta">${b.photo ? `${b.role}. In ${daysText(b.days)}.` : b.role}</span>
        </span>
      </label>`).join('');
    frameAll($$('.pick__face', barbersEl));
    barbersEl.addEventListener('change', (e) => pickBarber(e.target.value));
  }

  function pickBarber(id) {
    const b = BARBERS.find((x) => x.id === id) ?? null;
    state.barber = b;
    const input = barbersEl?.querySelector(`input[value="${b ? b.id : ''}"]`);
    if (input) input.checked = true;
    // a day the new barber is not in, and any time on it, no longer holds
    if (b && state.date && !b.days.includes(state.date.getDay())) { state.date = null; state.time = null; }
    else if (state.time) state.time = null;
    paintDays();
    if (state.date) renderSlots(); else { slotsEl.innerHTML = ''; dayLabel.textContent = ''; }
    render();
    if (global) document.dispatchEvent(new CustomEvent('booking:barber-changed', { detail: { id: b?.id ?? '' } }));
  }

  /* ── step 2: days and slots ── */
  const daysEl = $('[data-days]'), slotsEl = $('[data-slots]'), dayLabel = $('[data-daylabel]');
  const days = [];
  { const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < BOOKING.daysAhead; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); } }

  function paintDays() {
    daysEl.innerHTML = days.map((d, i) => {
      const closed = !BOOKING.hours[d.getDay()];
      const off = !closed && state.barber && !state.barber.days.includes(d.getDay());
      const note = closed ? 'Closed' : off ? `${state.barber.first} off` : fmtMon.format(d);
      const picked = state.date && +state.date === +d;
      return `<button type="button" class="day" role="radio" aria-checked="${!!picked}" data-day="${i}" ${closed || off ? 'disabled' : ''}
        aria-label="${fmtDay.format(d)}${closed ? ', closed' : off ? `, ${state.barber.first} is off` : ''}">
        <span class="day__dow">${fmtDow.format(d)}</span><span class="day__num">${d.getDate()}</span><span class="day__mon">${note}</span>
      </button>`;
    }).join('');
  }
  paintDays();

  daysEl.addEventListener('click', (e) => {
    const b = e.target.closest('.day'); if (!b || b.disabled) return;
    state.date = days[+b.dataset.day]; state.time = null;
    $$('.day', daysEl).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    renderSlots(); render();
  });

  let slotRun = 0;
  async function renderSlots() {
    if (!state.date || !state.service) return;
    const run = ++slotRun;
    const list = await BOOKING.slots(state.date, state.service, state.barber);
    if (run !== slotRun) return;                           // a newer day was picked meanwhile
    dayLabel.textContent = `${fmtDay.format(state.date)} · ${state.service.name}, ${state.service.mins} min${state.barber ? ` with ${state.barber.first}` : ''}`;
    slotsEl.innerHTML = list.length
      ? list.map((t) => `<button type="button" class="slot" role="radio" aria-checked="${t === state.time}" data-time="${t}">${t}</button>`).join('')
      : '<p class="slots__empty">No times left on this day. Try the next one.</p>';
    const g = gsap();
    if (g && list.length) g.fromTo(slotsEl.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, ease: 'power3.out', stagger: { each: .018, from: 'start' }, overwrite: true, clearProps: 'all' });
  }

  slotsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.slot'); if (!b) return;
    state.time = b.dataset.time;
    $$('.slot', slotsEl).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    render();
  });

  // arrow keys inside the day and time groups
  [daysEl, slotsEl].forEach((group) => group.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const items = [...group.querySelectorAll('button:not(:disabled)')];
    const i = items.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    items[(i + dir + items.length) % items.length].focus();
  }));

  /* ── step 3: details ── */
  const fields = { name: $('[name="name"]'), phone: $('[name="phone"]'), email: $('[name="email"]'), notes: $('[name="notes"]') };
  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Write your name so we know who the chair is for.'),
    phone: (v) => (v.replace(/[^\d]/g, '').length >= 7 ? '' : 'Write a mobile number we can reach you on.'),
    email: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Check the email address, or leave it empty.'),
  };
  function validate(only) {
    let firstBad = null;
    for (const key of only ? [only] : Object.keys(rules)) {
      const msg = rules[key](fields[key].value);
      const err = $(`[data-error-for="${key}"]`);
      err.textContent = msg; err.id = `${ns}err-${key}`;
      fields[key].setAttribute('aria-invalid', String(!!msg));
      if (msg) fields[key].setAttribute('aria-describedby', err.id); else fields[key].removeAttribute('aria-describedby');
      if (msg && !firstBad) firstBad = fields[key];
    }
    return firstBad;
  }
  Object.keys(rules).forEach((key) => fields[key].addEventListener('blur', () => { if (fields[key].value || fields[key].getAttribute('aria-invalid') === 'true') validate(key); }));

  /* ── step changes ── */
  const canLeave = (step) => (step === 1 ? !!state.service : step === 2 ? !!(state.date && state.time) : true);
  const labels = { 1: 'Choose a time', 2: 'Add your details', 3: 'Confirm booking' };

  function render() {
    nextBtn.disabled = !canLeave(state.step);
    nextLabel.textContent = labels[state.step] ?? '';
    backBtn.hidden = state.step === 1;
    nav.hidden = state.step === 4;

    stepperBtns.forEach((b) => {
      const n = +b.dataset.goto;
      const reachable = state.step !== 4 && (n <= state.step || (n === 2 && canLeave(1)) || (n === 3 && canLeave(1) && canLeave(2)));
      b.disabled = !reachable;
      b.classList.toggle('is-current', n === state.step);
      b.classList.toggle('is-done', n < state.step || state.step === 4);
      if (n === state.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });

    setSum('service', state.service?.name, empty.service);
    if (sum.barber) setSum('barber', state.barber?.name, empty.barber);
    setSum('day', state.date && fmtDay.format(state.date), empty.day);
    setSum('time', state.time, empty.time);
    setSum('mins', state.service && `${state.service.mins} min`, '–');
    tweenPrice(state.service?.price ?? 0);
    onChange?.(state);
  }

  function setSum(key, value, fallback) {
    const el = sum[key], text = value || fallback;
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.toggle('is-set', !!value);
    const g = gsap();
    if (g && value) g.fromTo(el, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .4, ease: 'power3.out', overwrite: true, clearProps: 'transform' });
  }

  const priceObj = { v: 0 };
  function tweenPrice(to) {
    const g = gsap();
    if (!g) { priceObj.v = to; sum.price.textContent = `${BOOKING.currency}${to}`; return; }
    g.to(priceObj, { v: to, duration: .5, ease: 'power2.out', overwrite: true, onUpdate: () => { sum.price.textContent = `${BOOKING.currency}${Math.round(priceObj.v)}`; } });
  }

  function go(to, { focus = true } = {}) {
    if (to === state.step) return;
    const from = state.step, dir = to > from ? 1 : -1;
    const oldEl = steps.find((s) => +s.dataset.step === from), newEl = steps.find((s) => +s.dataset.step === to);
    state.step = to;
    if (to === 2 && !state.date) {                         // open on the first day that still has room
      const first = $$('.day:not(:disabled)', daysEl)[0];
      first?.click();
    } else if (to === 2) renderSlots();
    oldEl.hidden = true; oldEl.classList.remove('is-active');
    newEl.hidden = false; newEl.classList.add('is-active');
    render();

    const g = gsap();
    if (g) g.fromTo(newEl, { opacity: 0, x: 28 * dir }, { opacity: 1, x: 0, duration: .5, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' });
    if (focus) {
      const target = to === 3 ? fields.name : to === 4 ? newEl : newEl.querySelector('input:checked, [aria-checked="true"], input, button');
      target?.focus({ preventScroll: true });
    }
    if (global) {
      window.ScrollTrigger?.refresh();
      document.dispatchEvent(new CustomEvent('booking:step', { detail: { step: to } }));
    }
  }

  nextBtn.addEventListener('click', async () => {
    if (state.step < 3) return go(state.step + 1);
    const bad = validate();
    if (bad) return bad.focus();

    const payload = {
      service: { id: state.service.id, name: state.service.name, mins: state.service.mins, price: state.service.price },
      barber: state.barber ? { id: state.barber.id, name: state.barber.name } : null,
      date: iso(state.date), time: state.time,
      customer: { name: fields.name.value.trim(), phone: fields.phone.value.trim(), email: fields.email.value.trim(), notes: fields.notes.value.trim() },
    };
    nextBtn.disabled = true; nextLabel.textContent = 'Sending';
    try {
      const res = await BOOKING.submit(payload);
      // KERSIVO demo: the confirmation links straight to this booking on the owner dashboard.
      const dash = $('[data-kersivo-dashboard]');
      if (dash && res?.dashboardHref) dash.href = res.dashboardHref;
      window.dispatchEvent(new CustomEvent('heritage:booking', { detail: payload }));
      onChange?.(state);
      $('[data-done-title]').textContent = `${fmtDay.format(state.date)}, ${state.time}`;
      $('[data-done-body]').textContent = `${state.service.name}${state.barber ? ` with ${state.barber.name}` : ''}, ${state.service.mins} minutes, ${BOOKING.currency}${state.service.price} to pay in the shop. Booked under ${payload.customer.name}.`;
      go(4);
      const g = gsap();
      if (g) {
        const tick = $('.done__tick');
        g.fromTo(tick.children, { strokeDasharray: 200, strokeDashoffset: 200 }, { strokeDashoffset: 0, duration: .9, ease: 'power2.inOut', stagger: .35 });
      }
    } catch (err) {
      nextBtn.disabled = false; nextLabel.textContent = labels[3];
      const e = $('[data-error-for="email"]');
      e.textContent = 'The booking did not go through. Try again in a moment.';
    }
  });

  backBtn.addEventListener('click', () => go(state.step - 1));
  stepperBtns.forEach((b) => b.addEventListener('click', () => go(+b.dataset.goto)));

  function reset() {
    Object.assign(state, { service: null, barber: null, date: null, time: null });
    choices.querySelectorAll('input').forEach((i) => { i.checked = false; });
    const any = barbersEl?.querySelector('input[value=""]'); if (any) any.checked = true;
    paintDays();
    slotsEl.innerHTML = ''; dayLabel.textContent = '';
    Object.values(fields).forEach((f) => { f.value = ''; f.removeAttribute('aria-invalid'); });
    $$('.field__error').forEach((e) => { e.textContent = ''; });
    go(1, { focus: false });
  }
  $('[data-restart]')?.addEventListener('click', () => { reset(); newFocus(); });
  function newFocus() { steps[0].querySelector('input')?.focus({ preventScroll: true }); }

  render();
  const api = { pickService, pickBarber, go, reset, get step() { return state.step; }, get state() { return state; } };
  if (!global) return api;

  // "Book" on a row of the price list: preselect it and open the times
  document.addEventListener('booking:select', (e) => {
    pickService(e.detail.id);
    go(2, { focus: false });
  });

  // "Book with …" on the team page: preselect the barber; back to step 1 if no service is chosen yet
  document.addEventListener('booking:barber', (e) => {
    if (state.step === 4) reset();
    pickBarber(e.detail?.id ?? '');
    if (!state.service && state.step !== 1) go(1, { focus: false });
  });

  // ?barber=kit on the URL preselects too (links from other pages)
  const fromUrl = new URLSearchParams(location.search).get('barber');
  if (fromUrl && BARBERS.some((b) => b.id === fromUrl)) pickBarber(fromUrl);
  // ?service=skin-fade preselects the service (the "Book this cut" links on gallery.html)
  const svcFromUrl = new URLSearchParams(location.search).get('service');
  if (svcFromUrl && $(`[data-services] input[value="${CSS.escape(svcFromUrl)}"]`)) pickService(svcFromUrl);

  render();
  return api;
}
