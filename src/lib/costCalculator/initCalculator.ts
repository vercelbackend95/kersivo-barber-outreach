/**
 * Client entry point for the cost calculator.
 * DOM → scenario adapter → calculateMonthlyCosts() → results view → renderer.
 * Provider costs are only ever produced by the calculation engine.
 */

import {
  calculateMonthlyCosts,
  type CostScenarioInput,
  type ValidationIssue,
} from './barberSoftwareCostEngine';
import {
  MARKETPLACE_CLIENTS_FIELD,
  NUMBER_FIELDS,
  SPLIT_ASSUMPTIONS_TOGGLE,
  SPLIT_FIELDS,
  validationMessage,
} from './calculatorUi';
import { initCalculatorShell } from './initCalculatorShell';
import { renderResults } from './renderResults';
import { buildResultsView } from './resultView';

const READY_FLAG = 'calcReady';

function control(form: HTMLFormElement, name: string): HTMLInputElement | null {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement ? element : null;
}

function readNumber(form: HTMLFormElement, name: string): number {
  const raw = control(form, name)?.value.trim() ?? '';
  return raw === '' ? Number.NaN : Number(raw);
}

function readChecked(form: HTMLFormElement, name: string): boolean {
  return control(form, name)?.checked ?? false;
}

function readYesNo(form: HTMLFormElement, name: string): boolean {
  const element = form.elements.namedItem(name);
  return element instanceof RadioNodeList ? element.value === 'yes' : false;
}

export function readScenario(form: HTMLFormElement): CostScenarioInput {
  return {
    bookableBarbers: readNumber(form, 'bookableBarbers'),
    monthlyAppointments: readNumber(form, 'monthlyAppointments'),
    averageAppointmentValueGbp: readNumber(form, 'averageAppointmentValueGbp'),
    marketplaceClients: readNumber(form, 'marketplaceClients'),
    booksyBoostEnabled: readChecked(form, 'booksyBoostEnabled'),
    splitMarketplaceAssumptions: readChecked(form, 'splitMarketplaceAssumptions'),
    booksyBoostClients: readNumber(form, 'booksyBoostClients'),
    freshaMarketplaceClients: readNumber(form, 'freshaMarketplaceClients'),
    freshaSmartWebsite: readChecked(form, 'freshaSmartWebsite'),
    freshaClientLoyalty: readChecked(form, 'freshaClientLoyalty'),
    vatRegistered: readYesNo(form, 'vatRegistered'),
    // Payment processing is not part of this calculation stage; the control is disabled.
    includePayments: false,
  };
}

function renderValidation(form: HTMLFormElement, issues: readonly ValidationIssue[]) {
  for (const field of NUMBER_FIELDS) {
    const input = form.ownerDocument.getElementById(field.id);
    const error = form.ownerDocument.getElementById(`${field.id}-error`);
    const issue = issues.find((entry) => entry.field === field.name);
    if (!input || !error) continue;

    if (issue) {
      input.setAttribute('aria-invalid', 'true');
      const message = validationMessage(issue.code, field);
      if (error.textContent !== message) error.textContent = message;
      error.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      error.textContent = '';
      error.hidden = true;
    }
  }
}

/** On first enabling split mode, start each provider-specific count from the shared count. */
function initSplitSeeding(form: HTMLFormElement) {
  const toggle = control(form, SPLIT_ASSUMPTIONS_TOGGLE.name);
  const shared = control(form, MARKETPLACE_CLIENTS_FIELD.name);
  const fields = SPLIT_FIELDS.map((field) => control(form, field.name)).filter(
    (input): input is HTMLInputElement => input !== null,
  );
  if (!toggle || !shared) return;

  for (const input of fields) {
    input.addEventListener('input', () => {
      input.dataset.userEdited = 'true';
    });
  }

  toggle.addEventListener('change', () => {
    if (!toggle.checked) return;
    for (const input of fields) {
      if (!input.dataset.userEdited) input.value = shared.value;
    }
  });
}

export function initCalculator(root: Document) {
  initCalculatorShell(root);

  const form = root.querySelector<HTMLFormElement>('[data-calc-form]');
  const results = root.querySelector<HTMLElement>('[data-calc-results]');
  if (!form || !results || form.dataset[READY_FLAG]) return;
  form.dataset[READY_FLAG] = 'true';

  initSplitSeeding(form);

  const recalculate = () => {
    const calculation = calculateMonthlyCosts(readScenario(form));
    renderValidation(form, calculation.ok ? [] : calculation.errors);
    renderResults(results, buildResultsView(calculation));
  };

  form.addEventListener('input', recalculate);
  form.addEventListener('change', recalculate);
  form.addEventListener('submit', () => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });

  recalculate();
}
