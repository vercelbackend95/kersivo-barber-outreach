/**
 * Client behaviour for /timely-alternative: the hero diary, scroll reveals, the bill builder and
 * the week timeline. No dependencies. Everything settles instantly under prefers-reduced-motion.
 */

export type TimelyTierId = 'run' | 'boost' | 'thrive';

export type BuilderConfig = {
  tiers: readonly { id: TimelyTierId; name: string; weeklyGbp: number }[];
  teamAddOnWeeklyGbp: number;
  kersivoFullGbp: number;
  starterMaxBarbers: number;
  features: readonly { id: string; label: string; timely: TimelyTierId | 'addon'; kersivo: 'starter' | 'full' | 'none' }[];
};

export type BuilderInput = {
  features: readonly string[];
  barbers: number;
  bookingsPerWeek: number;
  /** The shop's real weekly Timely invoice. 0 or less means "not entered". */
  actualWeeklyGbp: number;
};

export type BuilderEstimate = {
  tierId: TimelyTierId;
  tierName: string;
  needsTeamAddOn: boolean;
  timelyFromWeeklyGbp: number;
  timelyFromMonthlyGbp: number;
  timelyActualMonthlyGbp: number | null;
  timelyPerBookingGbp: number | null;
  kersivoPlan: 'starter' | 'full';
  kersivoMonthlyGbp: number;
  kersivoPerBookingGbp: number;
  /** Real Timely monthly cost minus KERSIVO; null until an invoice is entered. */
  monthlyDifferenceGbp: number | null;
  missingInKersivo: string[];
};

const WEEKS_PER_MONTH = 52 / 12;
const round2 = (value: number) => Math.round(value * 100) / 100;
const TIER_ORDER: readonly TimelyTierId[] = ['run', 'boost', 'thrive'];

export function estimateBill(config: BuilderConfig, input: BuilderInput): BuilderEstimate {
  const chosen = config.features.filter((feature) => input.features.includes(feature.id));
  let tierIndex = 0;
  let needsTeamAddOn = false;
  for (const feature of chosen) {
    if (feature.timely === 'addon') needsTeamAddOn = true;
    else tierIndex = Math.max(tierIndex, TIER_ORDER.indexOf(feature.timely));
  }
  const tier = config.tiers.find((item) => item.id === TIER_ORDER[tierIndex]) ?? config.tiers[0];
  const timelyFromWeeklyGbp = tier.weeklyGbp + (needsTeamAddOn ? config.teamAddOnWeeklyGbp : 0);

  const barbers = Math.max(1, Math.round(input.barbers));
  const needsFull = chosen.some((feature) => feature.kersivo === 'full') || barbers > config.starterMaxBarbers;
  const kersivoPlan = needsFull ? 'full' : 'starter';
  const kersivoMonthlyGbp = needsFull ? config.kersivoFullGbp : 0;

  const bookingsPerMonth = Math.max(1, input.bookingsPerWeek) * WEEKS_PER_MONTH;
  const actual = Number.isFinite(input.actualWeeklyGbp) && input.actualWeeklyGbp > 0 ? input.actualWeeklyGbp : null;
  const timelyActualMonthlyGbp = actual === null ? null : round2(actual * WEEKS_PER_MONTH);

  return {
    tierId: tier.id,
    tierName: tier.name,
    needsTeamAddOn,
    timelyFromWeeklyGbp,
    timelyFromMonthlyGbp: round2(timelyFromWeeklyGbp * WEEKS_PER_MONTH),
    timelyActualMonthlyGbp,
    timelyPerBookingGbp: timelyActualMonthlyGbp === null ? null : round2(timelyActualMonthlyGbp / bookingsPerMonth),
    kersivoPlan,
    kersivoMonthlyGbp,
    kersivoPerBookingGbp: round2(kersivoMonthlyGbp / bookingsPerMonth),
    monthlyDifferenceGbp: timelyActualMonthlyGbp === null ? null : round2(timelyActualMonthlyGbp - kersivoMonthlyGbp),
    missingInKersivo: chosen.filter((feature) => feature.kersivo === 'none').map((feature) => feature.label),
  };
}

export function formatPounds(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function describeEstimate(estimate: BuilderEstimate): string {
  const kersivo = estimate.kersivoPlan === 'full' ? 'Full KERSIVO' : 'KERSIVO Starter';
  const diff = estimate.monthlyDifferenceGbp;
  if (diff === null) {
    return `Timely ${estimate.tierName}${estimate.needsTeamAddOn ? ' with the team add-on' : ''} starts from ${formatPounds(estimate.timelyFromWeeklyGbp)} a week at its lowest booking level, and the bill rises as you take more bookings. ${kersivo} stays at ${formatPounds(estimate.kersivoMonthlyGbp)} a month however busy you get. Add your weekly Timely invoice for an exact comparison.`;
  }
  if (diff > 0.004) {
    return `On your real invoice, ${kersivo} costs ${formatPounds(diff)} less a month, about ${formatPounds(diff * 12)} a year, and it won’t rise with your bookings.`;
  }
  return `On your real invoice, Timely costs ${formatPounds(Math.abs(diff))} less a month today. ${kersivo}’s price won’t move as the diary fills, so weigh that against the features you need.`;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------- Hero ---------------------------------- */

function initHero(doc: Document): () => void {
  const diary = doc.querySelector<HTMLElement>('[data-ta-diary]');
  if (!diary) return () => {};
  const blocks = Array.from(diary.querySelectorAll<HTMLElement>('[data-ta-slot]'));
  const counter = diary.querySelector<HTMLElement>('[data-ta-count]');
  const meter = diary.querySelector<HTMLElement>('[data-ta-meter]');
  const replay = diary.querySelector<HTMLButtonElement>('[data-ta-replay]');
  const total = blocks.length;
  const timers: number[] = [];
  let frame = 0;

  const settle = () => {
    blocks.forEach((block) => (block.dataset.on = 'true'));
    if (counter) counter.textContent = String(total);
    meter?.style.setProperty('--fill', '1');
    diary.dataset.state = 'done';
  };

  const play = () => {
    timers.splice(0).forEach((id) => window.clearTimeout(id));
    cancelAnimationFrame(frame);
    if (reducedMotion()) return settle();
    blocks.forEach((block) => (block.dataset.on = 'false'));
    diary.dataset.state = 'playing';
    meter?.style.setProperty('--fill', '0');
    const step = 85;
    const start = 450;
    blocks.forEach((block, index) => {
      timers.push(
        window.setTimeout(() => {
          block.dataset.on = 'true';
          if (counter) counter.textContent = String(index + 1);
          meter?.style.setProperty('--fill', String((index + 1) / total));
          if (index === total - 1) diary.dataset.state = 'done';
        }, start + index * step),
      );
    });
  };

  const onReplay = () => play();
  replay?.addEventListener('click', onReplay);

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        play();
        observer.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  observer.observe(diary);

  return () => {
    observer.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
    cancelAnimationFrame(frame);
    replay?.removeEventListener('click', onReplay);
  };
}

/* --------------------------------- Reveals -------------------------------- */

function initReveals(doc: Document, root: HTMLElement): () => void {
  const targets = Array.from(doc.querySelectorAll<HTMLElement>('[data-ta-reveal]'));
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((target) => (target.dataset.in = 'true'));
    return () => {};
  }
  root.dataset.taMotion = 'true';
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.in = 'true';
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  );
  targets.forEach((target) => observer.observe(target));
  return () => observer.disconnect();
}

/* ---------------------------------- Week ---------------------------------- */

function initWeek(doc: Document): () => void {
  const week = doc.querySelector<HTMLElement>('[data-ta-week]');
  if (!week) return () => {};
  const days = Array.from(week.querySelectorAll<HTMLElement>('[data-ta-day]'));
  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = week.getBoundingClientRect();
    const view = window.innerHeight;
    const progress = Math.min(1, Math.max(0, (view * 0.6 - rect.top) / Math.max(1, rect.height - view * 0.25)));
    week.style.setProperty('--progress', progress.toFixed(4));
    const mark = view * 0.6;
    for (const day of days) {
      day.dataset.active = day.getBoundingClientRect().top < mark ? 'true' : 'false';
    }
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  if (reducedMotion()) {
    week.style.setProperty('--progress', '1');
    days.forEach((day) => (day.dataset.active = 'true'));
    return () => {};
  }
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

/* --------------------------------- Builder -------------------------------- */

function tween(el: HTMLElement, to: number, animate: boolean) {
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  if (!animate || from === to) {
    el.textContent = formatPounds(to);
    return;
  }
  const start = performance.now();
  const duration = 420;
  const step = (now: number) => {
    if (el.dataset.value !== String(to)) return;
    const t = Math.min(1, (now - start) / duration);
    el.textContent = formatPounds(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initBuilder(doc: Document): () => void {
  const form = doc.querySelector<HTMLFormElement>('[data-ta-builder]');
  if (!form) return () => {};
  const config = JSON.parse(form.dataset.taBuilder ?? '{}') as BuilderConfig;
  const q = (name: string) => form.querySelector<HTMLElement>(`[data-ta-out="${name}"]`);
  const num = (name: string) => Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? 0);

  const render = (animate: boolean) => {
    const features = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="feature"]:checked')).map((input) => input.value);
    const input: BuilderInput = {
      features,
      barbers: num('barbers'),
      bookingsPerWeek: num('bookingsPerWeek'),
      actualWeeklyGbp: num('actualWeeklyGbp'),
    };
    const estimate = estimateBill(config, input);
    const motion = animate && !reducedMotion();

    q('barbers')!.textContent = String(input.barbers);
    q('bookingsPerWeek')!.textContent = String(input.bookingsPerWeek);
    for (const range of form.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      const pct = ((Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
      range.style.setProperty('--fill', `${pct}%`);
    }

    const hasActual = estimate.timelyActualMonthlyGbp !== null;
    q('tier')!.textContent = `Timely ${estimate.tierName}${estimate.needsTeamAddOn ? ' + team add-on' : ''}`;
    q('timelyLabel')!.textContent = hasActual ? 'Your invoice, monthly' : 'From, monthly';
    tween(q('timely')!, hasActual ? estimate.timelyActualMonthlyGbp! : estimate.timelyFromMonthlyGbp, motion);
    q('timelySplit')!.textContent = hasActual
      ? `${formatPounds(input.actualWeeklyGbp)} a week × 52 ÷ 12 · ${formatPounds(estimate.timelyPerBookingGbp!)} per booking`
      : `From ${formatPounds(estimate.timelyFromWeeklyGbp)} a week, rising with bookings`;

    q('plan')!.textContent = estimate.kersivoPlan === 'full' ? 'Full KERSIVO' : 'KERSIVO Starter';
    tween(q('kersivo')!, estimate.kersivoMonthlyGbp, motion);
    q('kersivoSplit')!.textContent =
      estimate.kersivoPlan === 'full'
        ? `Flat per location · ${formatPounds(estimate.kersivoPerBookingGbp)} per booking at ${input.bookingsPerWeek} a week`
        : `Up to ${config.starterMaxBarbers} barbers · ${formatPounds(0)} per booking`;

    q('verdict')!.textContent = describeEstimate(estimate);
    const missing = q('missing')!;
    missing.hidden = estimate.missingInKersivo.length === 0;
    missing.textContent = estimate.missingInKersivo.length
      ? `Not in KERSIVO: ${estimate.missingInKersivo.join(', ')}. If you can’t run without these, Timely may suit you better.`
      : '';

    form.dataset.plan = estimate.kersivoPlan;
    form.dataset.tier = estimate.tierId;
    form.dataset.winner = estimate.monthlyDifferenceGbp === null ? 'unknown' : estimate.monthlyDifferenceGbp > 0 ? 'kersivo' : 'timely';
  };

  const onInput = () => render(true);
  const onSubmit = (event: Event) => event.preventDefault();
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('submit', onSubmit);
  render(false);
  return () => {
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    form.removeEventListener('submit', onSubmit);
  };
}

export function initTimelyAlternative(doc: Document): () => void {
  const root = doc.querySelector<HTMLElement>('main.ta');
  if (!root) return () => {};
  const cleanups = [initHero(doc), initReveals(doc, root), initWeek(doc), initBuilder(doc)];
  return () => cleanups.forEach((cleanup) => cleanup());
}
