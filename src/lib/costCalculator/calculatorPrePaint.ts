/**
 * Parser-blocking inline script rendered directly after the calculator form markup.
 * It sets only presentation state (Advanced costs open, reveal toggles) from the shared
 * scenario URL before first paint, so hydration does not shift the layout.
 * It never reads numbers, prices or totals; initCalculator() stays authoritative and
 * re-applies the fully decoded, engine-validated scenario on hydration.
 */

import { DEFAULT_SCENARIO, DEPOSIT_PROCESSING_TOGGLE, SPLIT_ASSUMPTIONS_TOGGLE } from './calculatorUi';
import { ADVANCED_SCENARIO_KEYS, SCENARIO_PARAMS } from './calculatorUrlState';

type PrePaintConfig = {
  /** [query param, default value] for every input inside Advanced costs. */
  advanced: readonly (readonly [string, boolean])[];
  /** Reveal toggles whose controlled fields change height when shown. */
  reveals: readonly (readonly [string, string])[];
};

const CONFIG: PrePaintConfig = {
  advanced: ADVANCED_SCENARIO_KEYS.map((key) => [SCENARIO_PARAMS[key], DEFAULT_SCENARIO[key]] as const),
  reveals: [
    [SCENARIO_PARAMS.splitMarketplaceAssumptions, SPLIT_ASSUMPTIONS_TOGGLE.id],
    [SCENARIO_PARAMS.includeDepositProcessing, DEPOSIT_PROCESSING_TOGGLE.id],
  ],
};

/** Booleans decode exactly like decodeScenarioQuery(): trimmed "1" or "0", anything else is ignored. */
const SOURCE = `(function (c) {
  var form = document.querySelector('[data-calc-form]');
  if (!form || form.dataset.calcReady) return;
  var q = new URLSearchParams(window.location.search);
  var flag = function (p) {
    var v = q.get(p);
    v = v === null ? null : v.trim();
    return v === '1' ? true : v === '0' ? false : null;
  };
  var advanced = form.querySelector('details.calc-advanced');
  var open = c.advanced.some(function (a) {
    var v = flag(a[0]);
    return v !== null && v !== a[1];
  });
  if (advanced && open) advanced.open = true;
  c.reveals.forEach(function (r) {
    var v = flag(r[0]);
    var toggle = document.getElementById(r[1]);
    var target = toggle && document.getElementById(toggle.getAttribute('aria-controls') || '');
    if (v === null || !toggle || !target) return;
    toggle.checked = v;
    target.hidden = !v;
  });
})`;

export const CALCULATOR_PREPAINT_SCRIPT = `${SOURCE}(${JSON.stringify(CONFIG)});`;
