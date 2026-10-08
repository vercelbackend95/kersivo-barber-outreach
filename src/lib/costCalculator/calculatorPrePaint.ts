/**
 * Inline script rendered before the calculator hero. It sets only presentation state (Advanced costs open,
 * reveal toggles) from the shared scenario URL as each element is parsed, before it can be painted.
 * It must not be placed inside the hero: a parser-blocking script there lets the browser paint a partial
 * form while stylesheets load, and the hero copy (vertically centred against the form) shifts as the rest
 * of the streamed form arrives. A MutationObserver callback runs before the next paint, so state lands on
 * elements as soon as they exist without adding a paint point.
 * It never reads numbers, prices or totals; initCalculator() stays authoritative and re-applies the
 * fully decoded, engine-validated scenario on hydration.
 */

import { DEFAULT_SCENARIO, DEPOSIT_PROCESSING_TOGGLE, SPLIT_ASSUMPTIONS_TOGGLE, NEARCUT_SUBSCRIPTION_TOGGLE } from './calculatorUi';
import { ADVANCED_SCENARIO_KEYS, SCENARIO_PARAMS } from './calculatorUrlState';

type PrePaintConfig = {
  /** [query param, default value] for every input inside Advanced costs. */
  advanced: readonly (readonly [string, boolean])[];
  /** [query param, toggle id] for reveal toggles whose controlled fields change height when shown. */
  reveals: readonly (readonly [string, string])[];
  timelyInvoiceParam: string;
};

const CONFIG: PrePaintConfig = {
  advanced: ADVANCED_SCENARIO_KEYS.map((key) => [SCENARIO_PARAMS[key], DEFAULT_SCENARIO[key]] as const),
  timelyInvoiceParam: SCENARIO_PARAMS.timelyMonthlyInvoiceGbp,
  reveals: [
    [SCENARIO_PARAMS.splitMarketplaceAssumptions, SPLIT_ASSUMPTIONS_TOGGLE.id],
    [SCENARIO_PARAMS.includeDepositProcessing, DEPOSIT_PROCESSING_TOGGLE.id],
    [SCENARIO_PARAMS.nearcutSubscription, NEARCUT_SUBSCRIPTION_TOGGLE.id],
  ],
};

/** Booleans decode exactly like decodeScenarioQuery(): trimmed "1" or "0", anything else is ignored. */
const SOURCE = `(function (c) {
  var q = new URLSearchParams(window.location.search);
  var flag = function (p) {
    var v = q.get(p);
    v = v === null ? null : v.trim();
    return v === '1' ? true : v === '0' ? false : null;
  };
  var open = c.advanced.some(function (a) {
    var v = flag(a[0]);
    return v !== null && v !== a[1];
  }) || (Number(q.get(c.timelyInvoiceParam)) > 0 && Number.isFinite(Number(q.get(c.timelyInvoiceParam))));
  var reveals = c.reveals
    .map(function (r) {
      return [flag(r[0]), r[1]];
    })
    .filter(function (r) {
      return r[0] !== null;
    });
  if (!open && !reveals.length) return;
  var observer;
  var stop = function () {
    if (observer) observer.disconnect();
    document.removeEventListener('DOMContentLoaded', stop);
  };
  var apply = function () {
    var form = document.querySelector('[data-calc-form]');
    if (!form) return;
    if (form.dataset.calcReady) return stop();
    if (open) {
      var advanced = form.querySelector('details.calc-advanced');
      if (advanced) {
        advanced.open = true;
        open = false;
      }
    }
    reveals = reveals.filter(function (r) {
      var toggle = document.getElementById(r[1]);
      var target = toggle && document.getElementById(toggle.getAttribute('aria-controls') || '');
      if (!target) return true;
      toggle.checked = r[0];
      target.hidden = !r[0];
      return false;
    });
    if (!open && !reveals.length) stop();
  };
  observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', stop);
  apply();
})`;

export const CALCULATOR_PREPAINT_SCRIPT = `${SOURCE}(${JSON.stringify(CONFIG)});`;
