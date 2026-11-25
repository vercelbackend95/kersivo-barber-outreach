/**
 * Client behaviour for /barbershop-online-booking.
 *
 * - Hero simulator: service → barber → time → confirm on a phone, with free times worked out from
 *   the demo diary. Confirming flies a ticket from the phone into the real KERSIVO owner timeline
 *   beside it, where the booking opens (moment 1), and that time is no longer offered.
 * - Availability: tap any start time on one demo day and read why it is or isn't offered; the real
 *   KERSIVO timeline beside it shows the new booking or the appointment in the way (moment 2).
 * - Payments: plan, rule and price → online now vs in the shop, from the live payment policy.
 * - Hub: pulses run only on screen, with a pause control.
 *
 * Motion uses the Web Animations API on transform and opacity only. Under
 * prefers-reduced-motion everything still works, nothing flies or slides.
 * Returns a cleanup for Astro's ClientRouter (astro:before-swap).
 */
import {
  BOOKING_DEPOSIT_CAP_PENCE,
  resolveRequiredBookingPayment,
  resolveStarterPublicPaymentMode,
} from '@/lib/booking/bookingPaymentPolicy';
import {
  type SimAppointment,
  judgeStart,
  minuteLabel,
  offeredStarts,
  poundsLabel,
} from './bookingTimes';
import type { BookingSimulatorData } from './bookingSimulator';
import { HERO_DEMO_NOW_MINUTE, sendLiveDiary } from './liveDiaryEvents';

type Cleanup = () => void;

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readJson<T>(root: ParentNode, selector: string): T | null {
  const node = root.querySelector<HTMLScriptElement>(selector);
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as T;
  } catch {
    return null;
  }
}

function on<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Document | Window,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  disposers: Cleanup[],
  options?: AddEventListenerOptions,
) {
  target.addEventListener(type, handler as EventListener, options);
  disposers.push(() => target.removeEventListener(type, handler as EventListener, options));
}

/* ---------- Hero simulator ---------- */

type Pane = 'service' | 'barber' | 'time' | 'details' | 'done';
const PANES: Pane[] = ['service', 'barber', 'time', 'details', 'done'];

function initSimulator(root: HTMLElement, disposers: Cleanup[]) {
  const sim = root.querySelector<HTMLElement>('[data-bob-sim]');
  const data = sim ? readJson<BookingSimulatorData>(sim, '[data-bob-sim-data]') : null;
  if (!sim || !data) return;

  const panes = new Map(PANES.map((id) => [id, sim.querySelector<HTMLElement>(`[data-bob-pane="${id}"]`)!]));
  const progress = [...sim.querySelectorAll<HTMLElement>('[data-bob-progress]')];
  const timesBox = sim.querySelector<HTMLElement>('[data-bob-times]')!;
  const timeHint = sim.querySelector<HTMLElement>('[data-bob-time-hint]');
  const back = sim.querySelector<HTMLButtonElement>('[data-bob-back]')!;
  const status = sim.querySelector<HTMLElement>('[data-bob-sim-status]');
  const out = (key: string) => sim.querySelector<HTMLElement>(`[data-bob-out="${key}"]`);

  const diary = new Map(data.barbers.map((b) => [b.id, b.appointments.slice() as SimAppointment[]]));
  const state: { pane: Pane; service?: string; barber?: string; start?: number } = { pane: 'service' };

  const service = () => data.services.find((s) => s.id === state.service);
  const barber = () => data.barbers.find((b) => b.id === state.barber);
  const owner = sim.querySelector<HTMLElement>('[data-bob-owner]');
  let booked = 0;

  sim.classList.add('is-live');

  const announce = (text: string) => {
    if (status) status.textContent = text;
  };

  const show = (pane: Pane, direction: 1 | -1 = 1) => {
    const previous = panes.get(state.pane)!;
    const next = panes.get(pane)!;
    state.pane = pane;
    if (previous !== next) {
      previous.hidden = true;
      previous.classList.remove('is-active');
      next.hidden = false;
      next.classList.add('is-active');
      if (!reducedMotion()) {
        next.animate(
          [
            { opacity: 0, transform: `translateX(${direction * 18}px)` },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: 280, easing: EASE_OUT },
        );
      }
    }
    const index = Math.min(PANES.indexOf(pane), 3);
    progress.forEach((item, i) => {
      item.classList.toggle('is-current', pane !== 'done' && i === index);
      item.classList.toggle('is-done', i < index || pane === 'done');
    });
    back.hidden = pane === 'service' || pane === 'done';
    const title = next.querySelector<HTMLElement>('.bob-pane__title');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  };

  const renderTimes = () => {
    const svc = service();
    const who = barber();
    if (!svc || !who) return;
    // The phone books "today" on the timeline's demo clock, so only times after now are offered.
    const starts = offeredStarts(diary.get(who.id) ?? [], data.open, data.close, svc.duration, data.step).filter(
      (m) => m > HERO_DEMO_NOW_MINUTE,
    );
    if (timeHint) timeHint.textContent = `${svc.name} with ${who.firstName}`;
    const groups: Array<[string, number[]]> = [
      ['Morning', starts.filter((m) => m < 12 * 60)],
      ['Afternoon', starts.filter((m) => m >= 12 * 60 && m < 17 * 60)],
      ['Evening', starts.filter((m) => m >= 17 * 60)],
    ];
    timesBox.replaceChildren();
    if (starts.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bob-times__empty';
      empty.textContent = `${who.firstName} has no free time left for this service today.`;
      timesBox.append(empty);
      return;
    }
    for (const [label, list] of groups) {
      if (list.length === 0) continue;
      const group = document.createElement('div');
      group.className = 'bob-times__group';
      const heading = document.createElement('p');
      heading.className = 'bob-times__label';
      heading.textContent = label;
      const grid = document.createElement('div');
      grid.className = 'bob-times__grid';
      for (const minute of list) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bob-time';
        button.dataset.bobTime = String(minute);
        button.textContent = minuteLabel(minute);
        grid.append(button);
      }
      group.append(heading, grid);
      timesBox.append(group);
    }
  };

  const fillSummary = () => {
    const svc = service();
    const who = barber();
    if (!svc || !who || state.start === undefined) return;
    out('service')!.textContent = `${svc.name} · ${svc.duration} min`;
    out('barber')!.textContent = who.name;
    out('time')!.textContent = `${minuteLabel(state.start)}–${minuteLabel(state.start + svc.duration)}`;
    out('price')!.textContent = poundsLabel(svc.pricePence);
  };

  /* The confirmed booking goes into the real owner timeline beside the phone (moment 1). */
  const landBooking = () => {
    const svc = service();
    const who = barber();
    if (!svc || !who || state.start === undefined) return;
    const start = state.start;
    diary.get(who.id)?.push({ start, end: start + svc.duration, service: svc.name });
    booked += 1;
    sendLiveDiary({
      target: 'hero',
      type: 'add',
      id: `bob-hero-new-${booked}`,
      barberId: who.id,
      start,
      end: start + svc.duration,
      serviceName: svc.name,
      pricePence: svc.pricePence,
      clientName: 'You',
      tag: 'Booked online',
    });

    const source = panes.get('details')!.querySelector<HTMLElement>('.bob-summary');
    const frame = owner?.querySelector<HTMLElement>('.bob-owner__frame');
    const from = source?.getBoundingClientRect();
    const to = frame?.getBoundingClientRect();
    const onScreen = (r?: DOMRect | null) => !!r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    if (reducedMotion() || !onScreen(from) || !onScreen(to)) return;

    // The ticket: a copy of the summary card that travels into the owner timeline.
    const ticket = document.createElement('div');
    ticket.className = 'bob-ticket';
    ticket.setAttribute('aria-hidden', 'true');
    ticket.innerHTML = `<b>${svc.name}</b><span>${minuteLabel(start)} · ${who.firstName}</span>`;
    const w = Math.min(220, to!.width - 32);
    const h = 52;
    const left = to!.left + (to!.width - w) / 2;
    const top = to!.top + Math.min(to!.height * 0.45, 220);
    Object.assign(ticket.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    document.body.append(ticket);
    const dx = from!.left - left;
    const dy = from!.top - top;
    const sx = from!.width / w;
    const sy = from!.height / h;
    const flight = ticket.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.25, offset: 0 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 36}px) scale(1.04)`, opacity: 1, offset: 0.5 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'translate(0, 0) scale(0.92)', opacity: 0, offset: 1 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
    );
    flight.onfinish = () => ticket.remove();
    disposers.push(() => ticket.remove());
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!el || !sim.contains(el) || el.disabled) return;

    if (el.dataset.bobService) {
      state.service = el.dataset.bobService;
      sim.querySelectorAll('[data-bob-service]').forEach((b) => b.classList.toggle('is-on', b === el));
      show('barber');
      announce(`${service()?.name} chosen. Choose a barber.`);
    } else if (el.dataset.bobBarber) {
      state.barber = el.dataset.bobBarber;
      sim.querySelectorAll('[data-bob-barber]').forEach((b) => b.classList.toggle('is-on', b === el));
      renderTimes();
      show('time');
      announce(`${barber()?.name} chosen. Pick a time.`);
    } else if (el.dataset.bobTime) {
      state.start = Number(el.dataset.bobTime);
      fillSummary();
      show('details');
      announce(`${minuteLabel(state.start)} chosen. Check and confirm.`);
    } else if (el.hasAttribute('data-bob-confirm')) {
      const svc = service();
      const who = barber();
      if (!svc || !who || state.start === undefined) return;
      out('done')!.textContent = `${svc.name} with ${who.name}, ${minuteLabel(state.start)}–${minuteLabel(state.start + svc.duration)}.`;
      landBooking();
      show('done');
      sim.classList.add('has-booked');
      announce(`Booked. ${svc.name} with ${who.name} at ${minuteLabel(state.start)} is now in the owner’s KERSIVO timeline, and that time is no longer offered.`);
    } else if (el.hasAttribute('data-bob-again')) {
      state.service = undefined;
      state.barber = undefined;
      state.start = undefined;
      sim.querySelectorAll('[data-bob-service], [data-bob-barber]').forEach((b) => b.classList.remove('is-on'));
      show('service', -1);
      announce('Choose a service.');
    } else if (el.hasAttribute('data-bob-back')) {
      const index = PANES.indexOf(state.pane);
      const previous = PANES[Math.max(0, index - 1)]!;
      if (state.pane === 'details') state.start = undefined;
      show(previous, -1);
      announce(`Back to ${previous === 'service' ? 'services' : previous === 'barber' ? 'barbers' : 'times'}.`);
    }
  };

  on(sim, 'click', onClick, disposers);
}

/* ---------- Availability: tap a start time, watch the real timeline ---------- */

type ScrubData = {
  open: number;
  close: number;
  step: number;
  barber: string;
  barberId: string;
  appointments: SimAppointment[];
  services: Array<{ id: string; name: string; duration: number; pricePence: number }>;
  initialStart: number;
  initialService: string;
};

const AVAIL_PREVIEW_ID = 'bob-avail-preview';

function initScrubber(root: HTMLElement, disposers: Cleanup[]) {
  const box = root.querySelector<HTMLElement>('[data-bob-scrub]');
  const data = box ? readJson<ScrubData>(box, '[data-bob-scrub-data]') : null;
  if (!box || !data) return;
  const verdictEl = box.querySelector<HTMLElement>('[data-bob-verdict]')!;
  const text = box.querySelector<HTMLElement>('[data-bob-readout-text]')!;
  const offeredName = box.querySelector<HTMLElement>('[data-bob-offered-name]');
  const slots = [...box.querySelectorAll<HTMLButtonElement>('[data-bob-start]')];
  const segs = [...box.querySelectorAll<HTMLButtonElement>('[data-bob-scrub-service]')];

  let start = data.initialStart;
  let svc = data.services.find((s) => s.id === data.initialService) ?? data.services[0]!;

  const lineFor = (at: number) => {
    const verdict = judgeStart(data.appointments, data.close, at, svc.duration);
    const end = at + svc.duration;
    if (verdict.ok) return { verdict, line: `${minuteLabel(at)}–${minuteLabel(end)} fits, so the booking page offers ${minuteLabel(at)}. It is now in ${data.barber}’s timeline.` };
    if (verdict.reason === 'closing') return { verdict, line: `${minuteLabel(at)}–${minuteLabel(end)} would run past closing at ${minuteLabel(data.close)}, so ${minuteLabel(at)} isn’t offered.` };
    if (verdict.reason === 'inside') {
      return { verdict, line: `${data.barber} is already with a client then (${verdict.appointment.service}, ${minuteLabel(verdict.appointment.start)}–${minuteLabel(verdict.appointment.end)}), so ${minuteLabel(at)} isn’t offered.` };
    }
    return {
      verdict,
      line: `The chair is free at ${minuteLabel(at)}, but a ${svc.duration}-minute ${svc.name.toLowerCase()} would run into the ${minuteLabel(verdict.appointment.start)} appointment, so ${minuteLabel(at)} isn’t offered.`,
    };
  };

  /* Offered and refused states for every start, for the chosen service. */
  const paintSlots = () => {
    const offered = new Set(offeredStarts(data.appointments, data.open, data.close, svc.duration, data.step));
    slots.forEach((slot, i) => {
      const minute = Number(slot.dataset.bobStart);
      const ok = offered.has(minute);
      const was = slot.classList.contains('is-ok');
      slot.classList.toggle('is-ok', ok);
      slot.classList.toggle('is-no', !ok);
      slot.setAttribute('aria-label', `${minuteLabel(minute)}, ${ok ? 'offered' : 'not offered'}`);
      if (was !== ok && !reducedMotion()) {
        slot.animate([{ transform: 'scale(0.86)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], {
          duration: 260,
          delay: Math.min(i * 6, 240),
          easing: EASE_OUT,
          fill: 'backwards',
        });
      }
    });
    if (offeredName) offeredName.textContent = svc.name;
  };

  const select = (minute: number, send: boolean) => {
    start = minute;
    const { verdict, line } = lineFor(minute);
    box.dataset.state = verdict.ok ? 'ok' : 'no';
    verdictEl.textContent = verdict.ok ? 'Offered' : 'Not offered';
    text.textContent = line;
    slots.forEach((slot) => {
      const on = Number(slot.dataset.bobStart) === minute;
      slot.classList.toggle('is-on', on);
      slot.setAttribute('aria-pressed', String(on));
    });
    if (!send) return;
    if (verdict.ok) {
      sendLiveDiary({
        target: 'availability',
        type: 'add',
        id: AVAIL_PREVIEW_ID,
        barberId: data.barberId,
        start: minute,
        end: minute + svc.duration,
        serviceName: svc.name,
        pricePence: svc.pricePence,
        clientName: 'New client',
        tag: 'Offered time',
      });
    } else {
      sendLiveDiary({ target: 'availability', type: 'remove', id: AVAIL_PREVIEW_ID });
      if (verdict.reason !== 'closing') {
        sendLiveDiary({ target: 'availability', type: 'focus', barberId: data.barberId, start: verdict.appointment.start });
      }
    }
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!el || !box.contains(el)) return;
    if (el.dataset.bobStart) {
      select(Number(el.dataset.bobStart), true);
    } else if (el.dataset.bobScrubService) {
      svc = data.services.find((s) => s.id === el.dataset.bobScrubService) ?? svc;
      segs.forEach((s) => s.setAttribute('aria-pressed', String(s === el)));
      sendLiveDiary({ target: 'availability', type: 'remove', id: AVAIL_PREVIEW_ID });
      paintSlots();
      select(start, false);
    }
  };

  on(box, 'click', onClick, disposers);
  box.classList.add('is-live');
  select(start, false);
}

/* ---------- Payments ---------- */

/* One running count per figure: a new change cancels the old one so it can't write a stale value back. */
const tweens = new WeakMap<HTMLElement, number>();

function tweenText(el: HTMLElement, fromPence: number, toPence: number) {
  cancelAnimationFrame(tweens.get(el) ?? 0);
  if (reducedMotion() || document.hidden || fromPence === toPence) {
    el.textContent = poundsLabel(toPence);
    return;
  }
  const t0 = performance.now();
  const duration = 360;
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round((fromPence + (toPence - fromPence) * eased) / 100) * 100;
    el.textContent = poundsLabel(t === 1 ? toPence : value);
    if (t < 1) tweens.set(el, requestAnimationFrame(tick));
  };
  tweens.set(el, requestAnimationFrame(tick));
}

function initPayments(root: HTMLElement, disposers: Cleanup[]) {
  const box = root.querySelector<HTMLElement>('[data-bob-pay]');
  if (!box) return;
  const price = box.querySelector<HTMLInputElement>('[data-bob-price]')!;
  const priceOut = box.querySelector<HTMLElement>('[data-bob-price-out]')!;
  const fullSet = box.querySelector<HTMLElement>('[data-bob-pay-full]')!;
  const starterSet = box.querySelector<HTMLElement>('[data-bob-pay-starter]')!;
  const nowEl = box.querySelector<HTMLElement>('[data-bob-pay-now]')!;
  const shopEl = box.querySelector<HTMLElement>('[data-bob-pay-shop]')!;
  const totalEl = box.querySelector<HTMLElement>('[data-bob-pay-total]')!;
  const stripeEl = box.querySelector<HTMLElement>('[data-bob-pay-stripe]')!;
  const explain = box.querySelector<HTMLElement>('[data-bob-pay-explain]')!;
  const bar = box.querySelector<HTMLElement>('[data-bob-bar-now]')!;
  const value = (name: string) => box.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';
  const deposit = poundsLabel(BOOKING_DEPOSIT_CAP_PENCE);

  let lastNow = BOOKING_DEPOSIT_CAP_PENCE;
  let lastShop = Number(price.value) * 100 - BOOKING_DEPOSIT_CAP_PENCE;

  const render = () => {
    const plan = value('bob-plan');
    const pricePence = Number(price.value) * 100;
    box.dataset.plan = plan;
    fullSet.hidden = plan !== 'full';
    starterSet.hidden = plan !== 'starter';
    const min = Number(price.min);
    const max = Number(price.max);
    price.style.setProperty('--p', `${((Number(price.value) - min) / (max - min)) * 100}%`);
    priceOut.textContent = poundsLabel(pricePence);

    let mode: 'NONE' | 'DEPOSIT' | 'FULL';
    let note: string;
    if (plan === 'starter') {
      const decision = resolveStarterPublicPaymentMode({
        servicePricePence: pricePence,
        requestedChoice: value('bob-choice') === 'FULL' ? 'FULL' : 'DEPOSIT',
      });
      mode = decision.ok ? decision.mode : 'FULL';
      note =
        pricePence === BOOKING_DEPOSIT_CAP_PENCE
          ? `A ${deposit} service on Starter is simply paid in full online.`
          : mode === 'DEPOSIT'
            ? `On Starter the client chose the ${deposit} deposit. It counts towards the ${poundsLabel(pricePence)} price; the rest is paid in the shop.`
            : `On Starter the client chose to pay the whole ${poundsLabel(pricePence)} online. Nothing is left to pay in the shop.`;
    } else {
      mode = (value('bob-rule') as typeof mode) || 'DEPOSIT';
      note =
        mode === 'NONE'
          ? `Nothing is paid online. The client pays ${poundsLabel(pricePence)} in the shop, so there is no Stripe fee on this booking.`
          : mode === 'DEPOSIT' && pricePence <= BOOKING_DEPOSIT_CAP_PENCE
            ? `The ${deposit} deposit covers the whole ${poundsLabel(pricePence)} price, so nothing is left to pay in the shop.`
            : mode === 'DEPOSIT'
            ? `The ${deposit} deposit counts towards the ${poundsLabel(pricePence)} price. The rest is paid in the shop.`
            : `The whole ${poundsLabel(pricePence)} is paid online when booking. Nothing is left to pay in the shop.`;
    }
    const nowPence = resolveRequiredBookingPayment({ mode, servicePricePence: pricePence }).amountPence;
    const shopPence = pricePence - nowPence;
    tweenText(nowEl, lastNow, nowPence);
    tweenText(shopEl, lastShop, shopPence);
    lastNow = nowPence;
    lastShop = shopPence;
    totalEl.textContent = poundsLabel(pricePence);
    stripeEl.textContent = nowPence === 0 ? 'None, nothing paid online' : 'On the online part, at your Stripe rate';
    bar.style.setProperty('--f', String(pricePence > 0 ? nowPence / pricePence : 0));
    explain.textContent = note;
  };

  on(box, 'input', render, disposers);
  on(box, 'change', render, disposers);
  disposers.push(() => [nowEl, shopEl].forEach((el) => cancelAnimationFrame(tweens.get(el) ?? 0)));
  render();
}

/* ---------- At a glance: one staggered reveal ---------- */

function initGlance(root: HTMLElement, disposers: Cleanup[]) {
  const card = root.querySelector<HTMLElement>('[data-bob-glance]');
  if (!card || reducedMotion() || !('IntersectionObserver' in window)) return;
  // Already on screen (a reload mid-page): show it as it is, no entrance.
  if (card.getBoundingClientRect().top < window.innerHeight * 0.9) return;
  card.classList.add('is-armed');
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      card.classList.add('is-shown');
      io.disconnect();
    },
    { rootMargin: '0px 0px -15% 0px' },
  );
  io.observe(card);
  disposers.push(() => io.disconnect());
}

/* ---------- How it works: fragment loops ---------- */

function initSteps(root: HTMLElement, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('.bob-steps');
  const steps = [...root.querySelectorAll<HTMLElement>('[data-bob-step]')];
  if (!section || steps.length === 0) return;
  section.classList.add('is-live');
  // Loops run only while their step is on screen.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((entry) => (entry.target as HTMLElement).classList.toggle('is-inview', entry.isIntersecting)),
    { rootMargin: '0px 0px -12% 0px', threshold: 0.35 },
  );
  steps.forEach((step) => io.observe(step));
  disposers.push(() => io.disconnect());
  const button = section.querySelector<HTMLButtonElement>('[data-bob-steps-pause]');
  const label = section.querySelector<HTMLElement>('[data-bob-steps-pause-label]');
  if (button) {
    on(
      button,
      'click',
      () => {
        const paused = section.classList.toggle('is-paused');
        button.setAttribute('aria-pressed', String(paused));
        if (label) label.textContent = paused ? 'Play animation' : 'Pause animation';
      },
      disposers,
    );
  }
}

/* ---------- Hub ---------- */

function initHub(root: HTMLElement, disposers: Cleanup[]) {
  const hub = root.querySelector<HTMLElement>('[data-bob-hub]');
  if (!hub) return;
  const button = hub.querySelector<HTMLButtonElement>('[data-bob-hub-pause]');
  const label = hub.querySelector<HTMLElement>('[data-bob-hub-pause-label]');
  const io = new IntersectionObserver(([entry]) => hub.classList.toggle('is-running', !!entry?.isIntersecting), { rootMargin: '0px 0px -10% 0px' });
  io.observe(hub);
  disposers.push(() => io.disconnect());
  if (button) {
    on(
      button,
      'click',
      () => {
        const paused = hub.classList.toggle('is-paused');
        button.setAttribute('aria-pressed', String(paused));
        if (label) label.textContent = paused ? 'Play animation' : 'Pause animation';
      },
      disposers,
    );
  }
}

/* ---------- Entry ---------- */

export function bindOnlineBookingPage(root: HTMLElement): Cleanup {
  const disposers: Cleanup[] = [];
  root.classList.add('bob-js');
  for (const init of [initSimulator, initGlance, initSteps, initScrubber, initPayments, initHub]) {
    try {
      init(root, disposers);
    } catch (error) {
      console.warn('[online-booking] a section failed to start', error);
    }
  }
  return () => {
    for (const dispose of disposers.splice(0)) dispose();
    delete root.dataset.bobBound;
  };
}
