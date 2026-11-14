/**
 * Client behaviour for /fresha-alternative: the pinned "why switch" stage, the act rail and the
 * platform-bill estimator. No dependencies; everything rests under prefers-reduced-motion.
 */

export type FreshaEstimatorConfig = {
  independentGbp: number;
  teamPerMemberGbp: number;
  vatPercent: number;
  marketplacePercent: number;
  marketplaceMinimumGbp: number;
  kersivoFullGbp: number;
  starterMaxBarbers: number;
};

export type FreshaEstimateInput = { barbers: number; newClients: number; firstVisitGbp: number };

export type FreshaEstimate = {
  freshaSubscriptionGbp: number;
  freshaMarketplaceGbp: number;
  freshaTotalGbp: number;
  kersivoFullGbp: number;
  starterEligible: boolean;
  starterMaxBarbers: number;
  monthlyDifferenceGbp: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Fresha subscription plus one-time Marketplace new-client fees, VAT included. Payment processing excluded. */
export function estimateFreshaBill(config: FreshaEstimatorConfig, input: FreshaEstimateInput): FreshaEstimate {
  const vat = 1 + config.vatPercent / 100;
  const barbers = Math.max(1, Math.round(input.barbers));
  const subscriptionEx = barbers === 1 ? config.independentGbp : config.teamPerMemberGbp * barbers;
  const feePerClient = Math.max((input.firstVisitGbp * config.marketplacePercent) / 100, config.marketplaceMinimumGbp);
  const marketplaceEx = Math.max(0, Math.round(input.newClients)) * feePerClient;
  const freshaSubscriptionGbp = round2(subscriptionEx * vat);
  const freshaMarketplaceGbp = round2(marketplaceEx * vat);
  const freshaTotalGbp = round2(freshaSubscriptionGbp + freshaMarketplaceGbp);
  return {
    freshaSubscriptionGbp,
    freshaMarketplaceGbp,
    freshaTotalGbp,
    kersivoFullGbp: config.kersivoFullGbp,
    starterEligible: barbers <= config.starterMaxBarbers,
    starterMaxBarbers: config.starterMaxBarbers,
    monthlyDifferenceGbp: round2(freshaTotalGbp - config.kersivoFullGbp),
  };
}

export function formatPounds(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function describeEstimate(estimate: FreshaEstimate): string {
  const diff = estimate.monthlyDifferenceGbp;
  if (diff > 0.004) {
    return `On these numbers, Full KERSIVO comes to ${formatPounds(diff)} less a month, about ${formatPounds(diff * 12)} a year, before payment processing.`;
  }
  if (estimate.starterEligible) {
    return `On these numbers, Fresha’s subscription and Marketplace fees cost less than Full KERSIVO. KERSIVO Starter is £0/month for up to ${estimate.starterMaxBarbers} barbers.`;
  }
  return 'On these numbers, Fresha’s subscription and Marketplace fees cost less than Full KERSIVO.';
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setActive(nodes: Iterable<Element>, index: number, attr: string) {
  for (const node of nodes) {
    const el = node as HTMLElement;
    el.dataset.active = el.getAttribute(attr) === String(index) ? 'true' : 'false';
  }
}

function initReasons(doc: Document): () => void {
  const layout = doc.querySelector<HTMLElement>('[data-fj-reasons]');
  if (!layout) return () => {};
  const steps = Array.from(layout.querySelectorAll<HTMLElement>('[data-fj-step]'));
  const scenes = layout.querySelectorAll('[data-fj-scene]');
  const ticks = layout.querySelectorAll('[data-fj-tick]');
  let current = 0;

  const activate = (index: number) => {
    if (index === current) return;
    current = index;
    setActive(steps, index, 'data-fj-step');
    setActive(scenes, index, 'data-fj-scene');
    setActive(ticks, index, 'data-fj-tick');
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate(Number((entry.target as HTMLElement).dataset.fjStep));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  steps.forEach((step) => observer.observe(step));
  layout.dataset.fjReady = 'true';
  return () => observer.disconnect();
}

function initRail(doc: Document): () => void {
  const rail = doc.querySelector<HTMLElement>('[data-fj-rail]');
  const hero = doc.querySelector('.fj-hero');
  const footer = doc.querySelector('#contact') ?? doc.querySelector('footer');
  if (!rail || !hero) return () => {};
  const links = Array.from(rail.querySelectorAll<HTMLAnchorElement>('[data-fj-rail-link]'));
  let pastHero = false;
  let beforeEnd = true;
  const sync = () => {
    rail.dataset.visible = pastHero && beforeEnd ? 'true' : 'false';
  };

  const heroObserver = new IntersectionObserver(([entry]) => {
    pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    sync();
  });
  heroObserver.observe(hero);

  const endObserver = new IntersectionObserver(([entry]) => {
    beforeEnd = !(entry.isIntersecting || entry.boundingClientRect.top < 0);
    sync();
  });
  if (footer) endObserver.observe(footer);

  const actObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).id;
        for (const link of links) {
          if (link.dataset.fjRailLink === id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );
  doc.querySelectorAll('[data-fj-act]').forEach((section) => actObserver.observe(section));

  return () => {
    heroObserver.disconnect();
    endObserver.disconnect();
    actObserver.disconnect();
  };
}

function tweenNumber(el: HTMLElement, to: number, duration: number) {
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  if (duration === 0 || from === to) {
    el.textContent = formatPounds(to);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatPounds(from + (to - from) * eased);
    if (t < 1 && el.dataset.value === String(to)) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initEstimator(doc: Document): () => void {
  const form = doc.querySelector<HTMLFormElement>('[data-fj-estimator]');
  if (!form) return () => {};
  const config = JSON.parse(form.dataset.fjEstimator ?? '{}') as FreshaEstimatorConfig;
  const out = (name: string) => form.querySelector<HTMLElement>(`[data-fj-out="${name}"]`);
  const result = (name: string) => form.querySelector<HTMLElement>(`[data-fj-result="${name}"]`);
  const value = (name: string) => Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? 0);

  const render = (animate: boolean) => {
    const input = { barbers: value('barbers'), newClients: value('newClients'), firstVisitGbp: value('firstVisitGbp') };
    const estimate = estimateFreshaBill(config, input);
    const duration = animate && !prefersReducedMotion() ? 420 : 0;

    out('barbers')!.textContent = String(input.barbers);
    out('newClients')!.textContent = String(input.newClients);
    out('firstVisitGbp')!.textContent = `£${input.firstVisitGbp}`;
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      const pct = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    }

    tweenNumber(result('fresha')!, estimate.freshaTotalGbp, duration);
    tweenNumber(result('kersivo')!, estimate.kersivoFullGbp, duration);
    result('freshaSplit')!.textContent = `${formatPounds(estimate.freshaSubscriptionGbp)} subscription + ${formatPounds(estimate.freshaMarketplaceGbp)} Marketplace fees, inc. VAT`;
    result('kersivoSplit')!.textContent = estimate.starterEligible
      ? `Full KERSIVO per location. Starter is £0 for up to ${estimate.starterMaxBarbers} barbers.`
      : 'Full KERSIVO per location, unlimited barbers (fair use)';
    result('year')!.textContent = describeEstimate(estimate);
    form.dataset.winner = estimate.monthlyDifferenceGbp > 0 ? 'kersivo' : 'fresha';
  };

  const onInput = () => render(true);
  const onSubmit = (event: Event) => event.preventDefault();
  form.addEventListener('input', onInput);
  form.addEventListener('submit', onSubmit);
  render(false);
  return () => {
    form.removeEventListener('input', onInput);
    form.removeEventListener('submit', onSubmit);
  };
}

export function initFreshaJourney(doc: Document): () => void {
  const cleanups = [initReasons(doc), initRail(doc), initEstimator(doc)];
  return () => cleanups.forEach((cleanup) => cleanup());
}
