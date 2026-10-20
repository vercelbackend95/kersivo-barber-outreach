/**
 * Progressive enhancement for Section 04 scaling costs.
 * All figures come from the SSR JSON payload — no client-side price formulae.
 */

import type { ScenarioComparison, ScenarioPeriod, ScenarioBarberCount } from '@/lib/seo/barbershopWebsiteCostScenarios';

type Payload = {
  defaults: { barbers: ScenarioBarberCount; period: ScenarioPeriod };
  barberCounts: readonly ScenarioBarberCount[];
  periods: readonly ScenarioPeriod[];
  states: Record<string, ScenarioComparison>;
};

function formatAxis(n: number): string {
  if (Number.isInteger(n)) return `£${n.toLocaleString('en-GB')}`;
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initWebsiteCostScenarios(root: HTMLElement): void {
  const payloadEl = root.querySelector<HTMLScriptElement>(
    'script[type="application/json"][data-bwcost-scenarios-payload]',
  );
  if (!payloadEl?.textContent) return;

  let payload: Payload;
  try {
    payload = JSON.parse(payloadEl.textContent) as Payload;
  } catch {
    return;
  }

  let barbers = payload.defaults.barbers;
  let period = payload.defaults.period;
  let activeId = 'full-kersivo';

  const barberButtons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-bwcost-barbers]'),
  ];
  const periodButtons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-bwcost-period]'),
  ];
  const cards = [...root.querySelectorAll<HTMLElement>('[data-bwcost-card]')];
  const breakdown = root.querySelector<HTMLElement>('[data-bwcost-breakdown]');
  const chartTitle = root.querySelector<HTMLElement>('[data-bwcost-chart-title]');
  const chartSub = root.querySelector<HTMLElement>('[data-bwcost-chart-sub]');
  const chartDesc = root.querySelector<HTMLElement>('[data-bwcost-chart-desc]');
  const summaryScenario = root.querySelector<HTMLElement>('[data-bwcost-summary-scenario]');
  const summaryFigure = root.querySelector<HTMLElement>('[data-bwcost-summary-figure]');
  const summaryCaption = root.querySelector<HTMLElement>('[data-bwcost-summary-caption]');
  const a11yTable = root.querySelector<HTMLElement>('[data-bwcost-a11y-table]');
  const axisMax = root.querySelector<HTMLElement>('[data-bwcost-axis-max]');
  const axisMid = root.querySelector<HTMLElement>('[data-bwcost-axis-mid]');

  function currentState(): ScenarioComparison {
    return payload.states[`${barbers}:${period}`]!;
  }

  function setPressed(buttons: HTMLButtonElement[], attr: string, value: string): void {
    for (const btn of buttons) {
      const on = btn.getAttribute(attr) === value;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-active', on);
    }
  }

  function renderBreakdown(state: ScenarioComparison): void {
    if (!breakdown) return;
    const row = state.providers.find((p) => p.id === activeId) ?? state.providers[5]!;
    const missing = row.missingFees
      .map((fee) => `<li>${fee}</li>`)
      .join('');
    const lines = row.breakdown
      .map(
        (line) => `
        <div class="bwcost-scenarios__bd-row">
          <dt>${line.label}</dt>
          <dd>
            <span class="bwcost-scenarios__bd-amount">${line.amountLabel}</span>
            ${line.note ? `<span class="bwcost-scenarios__bd-note">${line.note}</span>` : ''}
          </dd>
        </div>`,
      )
      .join('');

    breakdown.innerHTML = `
      <div class="bwcost-scenarios__bd-head">
        <p class="bwcost-scenarios__bd-kicker">Cost breakdown</p>
        <h3 class="bwcost-scenarios__bd-title">${row.name}</h3>
        <p class="bwcost-scenarios__bd-meta">${row.vatBasisLabel} · ${row.statusLabel}</p>
      </div>
      <dl class="bwcost-scenarios__bd-list">${lines}</dl>
      <div class="bwcost-scenarios__bd-foot">
        <p class="bwcost-scenarios__bd-total">
          <span>Selected scenario</span>
          <strong>${row.displayFigure}</strong>
        </p>
        ${row.figureSecondary ? `<p class="bwcost-scenarios__bd-sec">${row.figureSecondary}</p>` : ''}
        <p class="bwcost-scenarios__bd-incomplete">Published or indicative package costs — not a complete like-for-like TCO.</p>
        <ul class="bwcost-scenarios__bd-missing">${missing}</ul>
        ${
          row.sourceHref
            ? `<p><a class="bwcost-scenarios__bd-source" href="${row.sourceHref}"${
                row.sourceHref.startsWith('http')
                  ? ' target="_blank" rel="noopener noreferrer"'
                  : ''
              }>${row.sourceLabel ?? 'View source'} <span aria-hidden="true">↗</span></a></p>`
            : ''
        }
      </div>
    `;
  }

  function render(state: ScenarioComparison): void {
    if (chartTitle) chartTitle.textContent = state.chartTitle;
    if (chartSub) chartSub.textContent = state.chartSubheading;
    if (chartDesc) chartDesc.textContent = state.chartDescription;
    if (summaryScenario) summaryScenario.textContent = state.kersivoSummary.scenarioLabel;
    if (summaryFigure) summaryFigure.textContent = state.kersivoSummary.displayFigure;
    if (summaryCaption) summaryCaption.textContent = state.kersivoSummary.caption;
    if (axisMax) axisMax.textContent = formatAxis(state.chartMaxGbp);
    if (axisMid) axisMid.textContent = formatAxis(state.chartMaxGbp / 2);

    const animate = !prefersReducedMotion();

    for (const row of state.providers) {
      const col = root.querySelector<HTMLElement>(`[data-bwcost-bar="${row.id}"]`);
      if (!col) continue;
      const fill = col.querySelector<HTMLElement>('.bwcost-scenarios__bar-fill');
      const value = col.querySelector<HTMLElement>('.bwcost-scenarios__bar-value');
      const placeholder = col.querySelector<HTMLElement>('.bwcost-scenarios__bar-placeholder');
      const height =
        row.amountGbp == null
          ? 0
          : Math.max(8, Math.min(100, (row.amountGbp / state.chartMaxGbp) * 100));

      if (row.amountGbp == null) {
        if (fill) {
          fill.style.height = '0%';
          fill.hidden = true;
        }
        if (value) {
          value.hidden = true;
          value.textContent = '';
        }
        if (placeholder) {
          placeholder.hidden = false;
          placeholder.textContent = row.displayFigure;
        }
        col.classList.add('bwcost-scenarios__bar--quote');
      } else {
        if (placeholder) placeholder.hidden = true;
        col.classList.remove('bwcost-scenarios__bar--quote');
        if (fill) {
          fill.hidden = false;
          if (!animate) fill.style.transition = 'none';
          fill.style.height = `${height}%`;
        }
        if (value) {
          value.hidden = false;
          value.textContent = row.displayFigure;
        }
      }
    }

    for (const card of cards) {
      const id = card.getAttribute('data-bwcost-card');
      const row = state.providers.find((p) => p.id === id);
      if (!row) continue;
      const figure = card.querySelector<HTMLElement>('[data-bwcost-card-figure]');
      const secondary = card.querySelector<HTMLElement>('[data-bwcost-card-secondary]');
      const qualifier = card.querySelector<HTMLElement>('[data-bwcost-card-qualifier]');
      const vat = card.querySelector<HTMLElement>('[data-bwcost-card-vat]');
      const status = card.querySelector<HTMLElement>('[data-bwcost-card-status]');
      if (figure) figure.textContent = row.displayFigure;
      if (secondary) {
        if (row.figureSecondary) {
          secondary.hidden = false;
          secondary.textContent = row.figureSecondary;
        } else {
          secondary.hidden = true;
          secondary.textContent = '';
        }
      }
      if (qualifier) qualifier.textContent = row.billingQualifier;
      if (vat) vat.textContent = row.cardVatLabel;
      if (status) status.textContent = row.statusLabel;
      const selected = row.id === activeId;
      card.classList.toggle('is-active', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }

    if (a11yTable) {
      a11yTable.innerHTML = state.providers
        .map(
          (row) =>
            `<tr><th scope="row">${row.name}</th><td>${row.displayFigure}</td><td>${row.vatBasisLabel}</td></tr>`,
        )
        .join('');
    }

    renderBreakdown(state);
  }

  const activateFromKey = (event: KeyboardEvent, activate: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activate();
  };

  for (const btn of barberButtons) {
    const activate = () => {
      const next = Number(btn.getAttribute('data-bwcost-barbers'));
      if (!payload.barberCounts.includes(next as ScenarioBarberCount)) return;
      barbers = next as ScenarioBarberCount;
      setPressed(barberButtons, 'data-bwcost-barbers', String(barbers));
      render(currentState());
    };
    btn.addEventListener('click', activate);
    btn.addEventListener('keydown', (event) => activateFromKey(event, activate));
  }

  for (const btn of periodButtons) {
    const activate = () => {
      const next = btn.getAttribute('data-bwcost-period') as ScenarioPeriod;
      if (!payload.periods.includes(next)) return;
      period = next;
      setPressed(periodButtons, 'data-bwcost-period', period);
      render(currentState());
    };
    btn.addEventListener('click', activate);
    btn.addEventListener('keydown', (event) => activateFromKey(event, activate));
  }

  for (const card of cards) {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-bwcost-card');
      if (!id) return;
      activeId = id;
      render(currentState());
      breakdown?.focus({ preventScroll: false });
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      card.click();
    });
  }

  setPressed(barberButtons, 'data-bwcost-barbers', String(barbers));
  setPressed(periodButtons, 'data-bwcost-period', period);
  render(currentState());
}

