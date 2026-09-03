import { describe, expect, it } from 'vitest';

import { buildCalibrationCallPlan } from './costEstimator';
import { loadCalibrationCatalogue } from './dataset/loaders';
import {
  CALIBRATION_MODEL_SNAPSHOT,
  LIVE_CONFIRM_PHRASE,
  LIVE_MAX_CALLS_CAP,
  LIVE_MAX_COST_USD_CAP,
  parseCalibrationArgv,
  validateLiveActivation,
  validateLiveGuards,
} from './liveGuards';
import { SMOKE_MAX_PROVIDER_REQUESTS } from './scope/smokeManifest';

describe('calibration live guards', () => {
  const catalogue = loadCalibrationCatalogue();
  const model = CALIBRATION_MODEL_SNAPSHOT;

  const validLiveArgv = [
    '--live',
    '--scope',
    'smoke',
    '--confirm-spend',
    LIVE_CONFIRM_PHRASE,
    '--model',
    model,
    '--max-calls',
    String(LIVE_MAX_CALLS_CAP),
    '--max-cost-usd',
    String(LIVE_MAX_COST_USD_CAP),
    '--output-dir',
    'calibration-output/live-smoke',
  ];

  it('parses dry-run argv by default with full scope', () => {
    const result = parseCalibrationArgv([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.mode).toBe('dry-run');
      expect(result.args.scope).toBe('full');
    }
  });

  it('parses smoke scope', () => {
    const result = parseCalibrationArgv(['--scope', 'smoke']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.args.scope).toBe('smoke');
  });

  it('rejects unknown scope', () => {
    const result = parseCalibrationArgv(['--scope', 'tiny']);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown flags', () => {
    const result = parseCalibrationArgv(['--bogus']);
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate singleton flags', () => {
    const result = parseCalibrationArgv(['--scope', 'smoke', '--scope', 'full']);
    expect(result.ok).toBe(false);
  });

  it('rejects fractional maxCalls', () => {
    const result = parseCalibrationArgv(['--max-calls', '1.5']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MAX_CALLS_INVALID');
  });

  it('smoke plan stays within 20 provider requests', () => {
    const plan = buildCalibrationCallPlan(catalogue, model, 'smoke');
    expect(plan.totalMaxCalls).toBeLessThanOrEqual(SMOKE_MAX_PROVIDER_REQUESTS);
  });

  it('validates live activation with explicit output dir and exact model snapshot', () => {
    const parsed = parseCalibrationArgv(validLiveArgv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(true);
  });

  it('rejects live full scope', () => {
    const argv = validLiveArgv.map((token) => (token === 'smoke' ? 'full' : token));
    const parsed = parseCalibrationArgv(argv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LIVE_FULL_SCOPE_BLOCKED');
  });

  it('rejects model alias gpt-4o-mini', () => {
    const argv = [...validLiveArgv];
    const modelIdx = argv.indexOf(CALIBRATION_MODEL_SNAPSHOT);
    argv[modelIdx] = 'gpt-4o-mini';
    const parsed = parseCalibrationArgv(argv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MODEL_SNAPSHOT_INVALID');
  });

  it('rejects live without explicit output dir', () => {
    const parsed = parseCalibrationArgv(
      validLiveArgv.filter((a) => a !== '--output-dir' && a !== 'calibration-output/live-smoke'),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LIVE_OUTPUT_DIR_REQUIRED');
  });

  it('rejects max-calls above live cap', () => {
    const argv = validLiveArgv.map((token) =>
      token === String(LIVE_MAX_CALLS_CAP) ? String(LIVE_MAX_CALLS_CAP + 1) : token,
    );
    const parsed = parseCalibrationArgv(argv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LIVE_MAX_CALLS_CAP_EXCEEDED');
  });

  it('rejects max-cost above live cap', () => {
    const argv = validLiveArgv.map((token) =>
      token === String(LIVE_MAX_COST_USD_CAP) ? String(LIVE_MAX_COST_USD_CAP + 0.01) : token,
    );
    const parsed = parseCalibrationArgv(argv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LIVE_MAX_COST_CAP_EXCEEDED');
  });

  it('rejects missing confirmation', () => {
    const parsed = parseCalibrationArgv(validLiveArgv.filter((a) => a !== LIVE_CONFIRM_PHRASE && a !== '--confirm-spend'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = validateLiveActivation(parsed.args);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFIRM_SPEND_MISSING');
  });

  it('validates live guards against selected scope not full catalogue', () => {
    const smokePlan = buildCalibrationCallPlan(catalogue, model, 'smoke');
    const result = validateLiveGuards({
      mode: 'live',
      scope: 'smoke',
      model,
      confirmSpend: LIVE_CONFIRM_PHRASE,
      maxCalls: smokePlan.totalMaxCalls,
      maxCostUsd: smokePlan.estimatedMaxCostUsd + 0.01,
      outputDir: 'calibration-output/live-smoke',
      outputDirExplicit: true,
    });
    expect(result.ok).toBe(true);
  });

  it('blocks when smoke scope exceeds max-calls', () => {
    const smokePlan = buildCalibrationCallPlan(catalogue, model, 'smoke');
    const result = validateLiveGuards({
      mode: 'live',
      scope: 'smoke',
      model,
      confirmSpend: LIVE_CONFIRM_PHRASE,
      maxCalls: smokePlan.totalMaxCalls - 1,
      maxCostUsd: LIVE_MAX_COST_USD_CAP,
      outputDir: 'calibration-output/live-smoke',
      outputDirExplicit: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MAX_CALLS_EXCEEDED');
  });
});
