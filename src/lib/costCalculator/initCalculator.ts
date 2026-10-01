/**
 * Client entry point for the cost calculator.
 * DOM → scenario adapter → calculateMonthlyCosts() → results view → renderer.
 * Provider costs are only ever produced by the calculation engine.
 */

import {
  validateCostScenario,
  type CostScenarioInput,
  type ValidationIssue,
} from './barberSoftwareCostEngine';
import {
  DEFAULT_PERIOD,
  DEFAULT_SCENARIO,
  MARKETPLACE_CLIENTS_FIELD,
  NUMBER_FIELDS,
  SHARE_SCENARIO,
  SPLIT_ASSUMPTIONS_TOGGLE,
  SPLIT_FIELDS,
  validationMessage,
} from './calculatorUi';
import { buildScenarioUrl, decodeScenarioQuery, type DecodedUrlState } from './calculatorUrlState';
import { isCostPeriod, type CostPeriod } from './costPeriod';
import { initCalculatorShell } from './initCalculatorShell';
import { renderResults } from './renderResults';
import { buildCalculatorView } from './resultView';

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
    includeDepositProcessing: readChecked(form, 'includeDepositProcessing'),
    depositBookingsPerMonth: readNumber(form, 'depositBookingsPerMonth'),
  };
}

export function readPeriod(results: HTMLElement): CostPeriod {
  const selected = results.querySelector<HTMLInputElement>('[data-calc-period] input[name="period"]:checked');
  return isCostPeriod(selected?.value) ? selected.value : DEFAULT_PERIOD;
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

function setValue(form: HTMLFormElement, name: string, value: number) {
  const input = control(form, name);
  if (input) input.value = String(value);
}

function setChecked(form: HTMLFormElement, name: string, checked: boolean) {
  const input = control(form, name);
  if (input) input.checked = checked;
}

const ADVANCED_KEYS = ['vatRegistered', 'freshaSmartWebsite', 'freshaClientLoyalty', 'includeDepositProcessing'] as const;

/** Writes a decoded, engine-valid scenario into the form before any listener or reveal sync runs. */
export function applyScenarioToForm(form: HTMLFormElement, results: HTMLElement, state: DecodedUrlState) {
  const { scenario, period } = state;
  for (const field of NUMBER_FIELDS) setValue(form, field.name, scenario[field.name]);
  setChecked(form, 'booksyBoostEnabled', scenario.booksyBoostEnabled);
  setChecked(form, 'splitMarketplaceAssumptions', scenario.splitMarketplaceAssumptions);
  setChecked(form, 'freshaSmartWebsite', scenario.freshaSmartWebsite);
  setChecked(form, 'freshaClientLoyalty', scenario.freshaClientLoyalty);
  setChecked(form, 'includeDepositProcessing', scenario.includeDepositProcessing);
  const vat = form.querySelector<HTMLInputElement>(
    `input[name="vatRegistered"][value="${scenario.vatRegistered ? 'yes' : 'no'}"]`,
  );
  if (vat) vat.checked = true;

  // Loaded split counts are deliberate values, so enabling split later must not overwrite them.
  if (scenario.splitMarketplaceAssumptions) {
    for (const field of SPLIT_FIELDS) {
      const input = control(form, field.name);
      if (input) input.dataset.userEdited = 'true';
    }
  }

  const periodInput = results.querySelector<HTMLInputElement>(`[data-calc-period] input[value="${period}"]`);
  if (periodInput) periodInput.checked = true;

  const advanced = form.querySelector<HTMLDetailsElement>('details.calc-advanced');
  if (advanced && ADVANCED_KEYS.some((key) => scenario[key] !== DEFAULT_SCENARIO[key])) advanced.open = true;
}

async function copyText(doc: Document, text: string): Promise<boolean> {
  try {
    await doc.defaultView!.navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    doc.body.append(area);
    area.select();
    try {
      return doc.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

const SHARE_STATUS_MS = 4000;

function initShareLink(form: HTMLFormElement, results: HTMLElement) {
  const button = results.querySelector<HTMLButtonElement>('[data-calc-share]');
  const status = results.querySelector<HTMLElement>('[data-calc-share-status]');
  if (!button || !status) return;
  const doc = form.ownerDocument;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const show = (message: string) => {
    clearTimeout(timer);
    status.textContent = message;
    status.dataset.state = message === SHARE_SCENARIO.copied ? 'success' : 'error';
    timer = setTimeout(() => {
      status.textContent = '';
      delete status.dataset.state;
    }, SHARE_STATUS_MS);
  };

  button.addEventListener('click', async () => {
    const scenario = readScenario(form);
    if (validateCostScenario(scenario).length > 0) {
      show(SHARE_SCENARIO.invalid);
      return;
    }
    const url = buildScenarioUrl(doc.defaultView!.location.href, scenario, readPeriod(results));
    show((await copyText(doc, url)) ? SHARE_SCENARIO.copied : SHARE_SCENARIO.failed);
  });
}

export function initCalculator(root: Document) {
  const form = root.querySelector<HTMLFormElement>('[data-calc-form]');
  const results = root.querySelector<HTMLElement>('[data-calc-results]');

  if (form && results && !form.dataset[READY_FLAG]) {
    const state = decodeScenarioQuery(root.defaultView?.location.search ?? '');
    if (state.hasScenarioParams) applyScenarioToForm(form, results, state);
  }

  initCalculatorShell(root);

  if (!form || !results || form.dataset[READY_FLAG]) return;
  form.dataset[READY_FLAG] = 'true';

  initSplitSeeding(form);
  initShareLink(form, results);

  const recalculate = () => {
    const scenario = readScenario(form);
    renderValidation(form, validateCostScenario(scenario));
    renderResults(results, buildCalculatorView(scenario, readPeriod(results)));
  };

  form.addEventListener('input', recalculate);
  form.addEventListener('change', recalculate);
  results.querySelector('[data-calc-period]')?.addEventListener('change', recalculate);
  form.addEventListener('submit', () => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });

  recalculate();
}
