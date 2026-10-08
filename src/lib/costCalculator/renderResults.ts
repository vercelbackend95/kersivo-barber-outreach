/**
 * Applies a ResultsView to the server-rendered result cards.
 * Writes text only when it changes so unchanged values do not re-render or re-announce.
 */

import { caveatLabel } from './calculatorUi';
import type { ProviderView, ResultsView } from './resultView';

function setText(element: Element | null, text: string | null) {
  if (!element) return;
  const next = text ?? '';
  if (element.textContent !== next) element.textContent = next;
}

function setHidden(element: HTMLElement | null, hidden: boolean) {
  if (element && element.hidden !== hidden) element.hidden = hidden;
}

function setList(list: Element | null, items: readonly string[]) {
  if (!list) return;
  const current = [...list.children].map((child) => child.textContent);
  if (current.length === items.length && current.every((text, index) => text === items[index])) return;
  list.replaceChildren(
    ...items.map((text) => {
      const item = list.ownerDocument.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

function renderProvider(card: HTMLElement, view: ProviderView, periodLabel: string) {
  card.dataset.state = view.state;
  setText(card.querySelector('[data-calc-period-label]'), periodLabel);

  const total = card.querySelector<HTMLElement>('[data-slot="total"]');
  setText(total, view.total);
  if (total) total.dataset.size = view.totalSize;
  if (view.state === 'unavailable') total?.setAttribute('aria-hidden', 'true');
  else total?.removeAttribute('aria-hidden');
  setText(card.querySelector('[data-slot="total-sr"]'), view.totalSr);

  const customNote = card.querySelector<HTMLElement>('[data-slot="custom-note"]');
  setText(customNote, view.customNote);
  setHidden(customNote, !view.customNote);
  setText(card.querySelector('[data-slot="net"]'), view.net);
  const clientNote = card.querySelector<HTMLElement>('[data-slot="client-fee-note"]');
  setText(clientNote, view.clientFeeNote);
  setHidden(clientNote, !view.clientFeeNote);

  for (const cell of card.querySelectorAll<HTMLElement>('[data-summary]')) {
    setText(cell, view.summary[cell.dataset.summary as keyof ProviderView['summary']] ?? null);
  }

  for (const row of card.querySelectorAll<HTMLElement>('[data-line]')) {
    const cell = view.breakdown[row.dataset.line as keyof ProviderView['breakdown']];
    setText(row.querySelector('[data-slot="value"]'), cell?.value ?? null);
    setText(row.querySelector('[data-slot="detail"]'), cell?.detail ?? null);
  }

  setList(card.querySelector('[data-slot="warnings"]'), view.warnings);
  setList(card.querySelector('[data-slot="assumptions"]'), view.assumptions);
  setHidden(card.querySelector<HTMLElement>('[data-slot="notes"]'), view.warnings.length + view.assumptions.length === 0);

  const flag = card.querySelector<HTMLElement>('[data-slot="notes-flag"]');
  setText(flag, caveatLabel(view.warnings.length));
  setHidden(flag, view.warnings.length === 0);
}

export function renderResults(results: HTMLElement, view: ResultsView) {
  results.dataset.period = view.period;
  setHidden(results.querySelector<HTMLElement>('[data-slot="results-status"]'), view.ok);
  setHidden(results.querySelector<HTMLElement>('[data-calc-three-year-note]'), !view.showThreeYearNote);

  for (const provider of view.providers) {
    const card = results.querySelector<HTMLElement>(`[data-provider="${provider.id}"]`);
    if (card) renderProvider(card, provider, view.periodLabel);
  }

  setList(results.querySelector('[data-slot="shared-assumptions"]'), view.sharedAssumptions);
  setHidden(results.querySelector<HTMLElement>('[data-slot="shared-notes"]'), view.sharedAssumptions.length === 0);
  setText(results.querySelector('[data-slot="insight"]'), view.insight);
}
