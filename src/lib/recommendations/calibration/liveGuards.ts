import type { CalibrationCliArgs, CalibrationScope } from './types';
import { buildCalibrationCallPlan } from './costEstimator';
import { loadCalibrationCatalogue } from './dataset/loaders';
import {
  CALIBRATION_MODEL_ALLOWLIST,
  getModelPricing,
  isAllowedCalibrationModel,
} from './pricing/modelPricing';
import { isCalibrationScope } from './scope/types';

export const LIVE_CONFIRM_PHRASE = 'LIVE_OPENAI_CALIBRATION';
export const CALIBRATION_MODEL_SNAPSHOT = CALIBRATION_MODEL_ALLOWLIST[0];
export const LIVE_MAX_CALLS_CAP = 20;
export const LIVE_MAX_COST_USD_CAP = 0.05;

const KNOWN_FLAGS = new Set([
  '--live',
  '--scope',
  '--model',
  '--confirm-spend',
  '--max-calls',
  '--max-cost-usd',
  '--output-dir',
]);

const SINGLETON_FLAGS = new Set([
  '--live',
  '--scope',
  '--model',
  '--confirm-spend',
  '--max-calls',
  '--max-cost-usd',
  '--output-dir',
]);

const VALUE_FLAGS = new Set([
  '--scope',
  '--model',
  '--confirm-spend',
  '--max-calls',
  '--max-cost-usd',
  '--output-dir',
]);

export type ParseArgvResult =
  | { ok: true; args: CalibrationCliArgs }
  | { ok: false; code: string; message: string };

function isUnsafeOutputDir(outputDir: string): boolean {
  return outputDir.includes('..') || outputDir.includes('\0');
}

export function parseCalibrationArgv(argv: string[]): ParseArgvResult {
  const seenSingletons = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) {
      return { ok: false, code: 'UNKNOWN_ARG', message: `Unknown argument: ${token}` };
    }
    if (!KNOWN_FLAGS.has(token)) {
      return { ok: false, code: 'UNKNOWN_FLAG', message: `Unknown flag: ${token}` };
    }
    if (SINGLETON_FLAGS.has(token)) {
      if (seenSingletons.has(token)) {
        return { ok: false, code: 'DUPLICATE_FLAG', message: `Duplicate flag: ${token}` };
      }
      seenSingletons.add(token);
    }
    if (VALUE_FLAGS.has(token)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        return { ok: false, code: 'MISSING_FLAG_VALUE', message: `Missing value for ${token}` };
      }
      i += 1;
    }
  }

  const isLive = argv.includes('--live');
  const scopeIdx = argv.indexOf('--scope');
  const scopeRaw = scopeIdx >= 0 ? argv[scopeIdx + 1] : 'full';
  if (!isCalibrationScope(scopeRaw)) {
    return { ok: false, code: 'SCOPE_INVALID', message: `Unknown scope: ${scopeRaw}` };
  }
  const scope = scopeRaw as CalibrationScope;

  const outputIdx = argv.indexOf('--output-dir');
  const outputDirExplicit = outputIdx >= 0;
  const outputDir = outputDirExplicit && argv[outputIdx + 1] ? argv[outputIdx + 1]! : 'calibration-output';
  if (isUnsafeOutputDir(outputDir)) {
    return { ok: false, code: 'OUTPUT_DIR_INVALID', message: 'Invalid output directory' };
  }

  const modelIdx = argv.indexOf('--model');
  const confirmIdx = argv.indexOf('--confirm-spend');
  const maxCallsIdx = argv.indexOf('--max-calls');
  const maxCostIdx = argv.indexOf('--max-cost-usd');

  let maxCalls: number | undefined;
  if (maxCallsIdx >= 0) {
    const raw = argv[maxCallsIdx + 1]!;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, code: 'MAX_CALLS_INVALID', message: '--max-calls must be a positive integer' };
    }
    maxCalls = parsed;
  }

  let maxCostUsd: number | undefined;
  if (maxCostIdx >= 0) {
    const parsed = Number(argv[maxCostIdx + 1]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { ok: false, code: 'MAX_COST_INVALID', message: '--max-cost-usd must be a positive finite number' };
    }
    maxCostUsd = parsed;
  }

  return {
    ok: true,
    args: {
      mode: isLive ? 'live' : 'dry-run',
      scope,
      model: modelIdx >= 0 ? argv[modelIdx + 1] : undefined,
      confirmSpend: confirmIdx >= 0 ? argv[confirmIdx + 1] : undefined,
      maxCalls,
      maxCostUsd,
      outputDir,
      outputDirExplicit,
    },
  };
}

export type LiveGuardResult =
  | { ok: true; args: Required<Pick<CalibrationCliArgs, 'model' | 'maxCalls' | 'maxCostUsd' | 'scope' | 'outputDir'>> }
  | { ok: false; code: string; message: string };

export function validateLiveGuards(args: CalibrationCliArgs): LiveGuardResult {
  return validateLiveActivation(args);
}

export function validateLiveActivation(args: CalibrationCliArgs): LiveGuardResult {
  if (args.mode !== 'live') {
    return { ok: false, code: 'LIVE_MODE_NOT_REQUESTED', message: 'Live mode requires --live flag' };
  }

  if (args.confirmSpend !== LIVE_CONFIRM_PHRASE) {
    return {
      ok: false,
      code: 'CONFIRM_SPEND_MISSING',
      message: `Live mode requires --confirm-spend ${LIVE_CONFIRM_PHRASE}`,
    };
  }

  if (args.scope !== 'smoke') {
    return {
      ok: false,
      code: 'LIVE_FULL_SCOPE_BLOCKED',
      message: 'Live calibration is only permitted for --scope smoke',
    };
  }

  if (!args.outputDirExplicit) {
    return {
      ok: false,
      code: 'LIVE_OUTPUT_DIR_REQUIRED',
      message: 'Live mode requires an explicit --output-dir',
    };
  }

  if (!args.model) {
    return { ok: false, code: 'MODEL_MISSING', message: 'Live mode requires --model' };
  }

  if (args.model !== CALIBRATION_MODEL_SNAPSHOT) {
    return {
      ok: false,
      code: 'MODEL_SNAPSHOT_INVALID',
      message: `Live mode requires exact model snapshot: ${CALIBRATION_MODEL_SNAPSHOT}`,
    };
  }

  if (!isAllowedCalibrationModel(args.model)) {
    return {
      ok: false,
      code: 'MODEL_NOT_ALLOWLISTED',
      message: `Model not on calibration allowlist: ${args.model}`,
    };
  }

  if (!getModelPricing(args.model)) {
    return {
      ok: false,
      code: 'MODEL_PRICING_MISSING',
      message: `No pricing configured for model: ${args.model}`,
    };
  }

  if (args.maxCalls == null || !Number.isInteger(args.maxCalls) || args.maxCalls <= 0) {
    return {
      ok: false,
      code: 'MAX_CALLS_INVALID',
      message: 'Live mode requires --max-calls with a positive integer',
    };
  }

  if (args.maxCalls > LIVE_MAX_CALLS_CAP) {
    return {
      ok: false,
      code: 'LIVE_MAX_CALLS_CAP_EXCEEDED',
      message: `Live mode --max-calls cannot exceed ${LIVE_MAX_CALLS_CAP}`,
    };
  }

  if (args.maxCostUsd == null || !Number.isFinite(args.maxCostUsd) || args.maxCostUsd <= 0) {
    return {
      ok: false,
      code: 'MAX_COST_INVALID',
      message: 'Live mode requires --max-cost-usd with a positive decimal',
    };
  }

  if (args.maxCostUsd > LIVE_MAX_COST_USD_CAP) {
    return {
      ok: false,
      code: 'LIVE_MAX_COST_CAP_EXCEEDED',
      message: `Live mode --max-cost-usd cannot exceed ${LIVE_MAX_COST_USD_CAP}`,
    };
  }

  const catalogue = loadCalibrationCatalogue();
  const plan = buildCalibrationCallPlan(catalogue, args.model, args.scope);

  if (plan.totalMaxCalls > args.maxCalls) {
    return {
      ok: false,
      code: 'MAX_CALLS_EXCEEDED',
      message: `Estimated calls for scope ${args.scope} (${plan.totalMaxCalls}) exceed --max-calls (${args.maxCalls})`,
    };
  }

  if (plan.estimatedMaxCostUsd > args.maxCostUsd) {
    return {
      ok: false,
      code: 'MAX_COST_EXCEEDED',
      message: `Estimated cost for scope ${args.scope} ($${plan.estimatedMaxCostUsd.toFixed(4)}) exceeds --max-cost-usd ($${args.maxCostUsd})`,
    };
  }

  return {
    ok: true,
    args: {
      model: args.model,
      maxCalls: args.maxCalls,
      maxCostUsd: args.maxCostUsd,
      scope: args.scope,
      outputDir: args.outputDir,
    },
  };
}
