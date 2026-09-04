import type {
  CalibrationCachePolicy,
  CalibrationCliArgs,
  CalibrationScope,
} from './types';
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

export const CALIBRATION_CACHE_POLICIES = ['reuse', 'refresh', 'readonly'] as const;

const KNOWN_FLAG_NAMES = new Set([
  '--live',
  '--scope',
  '--model',
  '--confirm-spend',
  '--max-calls',
  '--max-cost-usd',
  '--output-dir',
  '--cache-policy',
]);

const SINGLETON_FLAG_NAMES = new Set([
  '--live',
  '--scope',
  '--model',
  '--confirm-spend',
  '--max-calls',
  '--max-cost-usd',
  '--output-dir',
  '--cache-policy',
]);

const VALUE_FLAG_NAMES = new Set([
  '--scope',
  '--model',
  '--confirm-spend',
  '--max-calls',
  '--max-cost-usd',
  '--output-dir',
  '--cache-policy',
]);

export type ParseArgvResult =
  | { ok: true; args: CalibrationCliArgs }
  | { ok: false; code: string; message: string };

function isUnsafeOutputDir(outputDir: string): boolean {
  return outputDir.includes('..') || outputDir.includes('\0');
}

function isCalibrationCachePolicy(value: string): value is CalibrationCachePolicy {
  return (CALIBRATION_CACHE_POLICIES as readonly string[]).includes(value);
}

type ParsedFlag = { name: string; value?: string };

type TokenizeOk = { ok: true; flags: ParsedFlag[] };
type TokenizeResult = TokenizeOk | { ok: false; code: string; message: string };

function tokenizeArgv(argv: string[]): TokenizeResult {
  const flags: ParsedFlag[] = [];
  const seenSingletons = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) {
      return { ok: false, code: 'UNKNOWN_ARG', message: `Unknown argument: ${token}` };
    }

    let name = token;
    let inlineValue: string | undefined;
    const eqIdx = token.indexOf('=');
    if (eqIdx >= 0) {
      name = token.slice(0, eqIdx);
      inlineValue = token.slice(eqIdx + 1);
    }

    if (!KNOWN_FLAG_NAMES.has(name)) {
      return { ok: false, code: 'UNKNOWN_FLAG', message: `Unknown flag: ${name}` };
    }

    if (SINGLETON_FLAG_NAMES.has(name)) {
      if (seenSingletons.has(name)) {
        return { ok: false, code: 'DUPLICATE_FLAG', message: `Duplicate flag: ${name}` };
      }
      seenSingletons.add(name);
    }

    if (!VALUE_FLAG_NAMES.has(name)) {
      if (inlineValue !== undefined) {
        return { ok: false, code: 'UNEXPECTED_FLAG_VALUE', message: `${name} does not take a value` };
      }
      flags.push({ name });
      continue;
    }

    if (inlineValue !== undefined) {
      if (inlineValue.length === 0) {
        return { ok: false, code: 'MISSING_FLAG_VALUE', message: `Missing value for ${name}` };
      }
      flags.push({ name, value: inlineValue });
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      return { ok: false, code: 'MISSING_FLAG_VALUE', message: `Missing value for ${name}` };
    }
    flags.push({ name, value: next });
    i += 1;
  }

  return { ok: true, flags };
}

function flagValue(flags: ParsedFlag[], name: string): string | undefined {
  return flags.find((flag) => flag.name === name)?.value;
}

export function parseCalibrationArgv(argv: string[]): ParseArgvResult {
  const tokenized = tokenizeArgv(argv);
  if (!tokenized.ok) {
    return { ok: false, code: tokenized.code, message: tokenized.message };
  }

  const { flags } = tokenized;
  const isLive = flags.some((flag) => flag.name === '--live');

  const scopeRaw = flagValue(flags, '--scope') ?? 'full';
  if (!isCalibrationScope(scopeRaw)) {
    return { ok: false, code: 'SCOPE_INVALID', message: `Unknown scope: ${scopeRaw}` };
  }
  const scope = scopeRaw as CalibrationScope;

  const outputDirExplicit = flags.some((flag) => flag.name === '--output-dir');
  const outputDir = flagValue(flags, '--output-dir') ?? 'calibration-output';
  if (isUnsafeOutputDir(outputDir)) {
    return { ok: false, code: 'OUTPUT_DIR_INVALID', message: 'Invalid output directory' };
  }

  const cachePolicyRaw = flagValue(flags, '--cache-policy') ?? 'reuse';
  if (!isCalibrationCachePolicy(cachePolicyRaw)) {
    return {
      ok: false,
      code: 'CACHE_POLICY_INVALID',
      message: `--cache-policy must be one of: ${CALIBRATION_CACHE_POLICIES.join(', ')}`,
    };
  }

  let maxCalls: number | undefined;
  const maxCallsRaw = flagValue(flags, '--max-calls');
  if (maxCallsRaw != null) {
    const parsed = Number(maxCallsRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, code: 'MAX_CALLS_INVALID', message: '--max-calls must be a positive integer' };
    }
    maxCalls = parsed;
  }

  let maxCostUsd: number | undefined;
  const maxCostRaw = flagValue(flags, '--max-cost-usd');
  if (maxCostRaw != null) {
    const parsed = Number(maxCostRaw);
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
      model: flagValue(flags, '--model'),
      confirmSpend: flagValue(flags, '--confirm-spend'),
      maxCalls,
      maxCostUsd,
      outputDir,
      outputDirExplicit,
      cachePolicy: cachePolicyRaw,
    },
  };
}

export type LiveGuardResult =
  | { ok: true; args: Required<Pick<CalibrationCliArgs, 'model' | 'maxCalls' | 'maxCostUsd' | 'scope' | 'outputDir' | 'cachePolicy'>> }
  | { ok: false; code: string; message: string };

export function validateLiveGuards(args: CalibrationCliArgs): LiveGuardResult {
  return validateLiveActivation(args);
}

export function validateLiveActivation(args: CalibrationCliArgs): LiveGuardResult {
  if (args.mode !== 'live') {
    return { ok: false, code: 'LIVE_MODE_NOT_REQUESTED', message: 'Live mode requires --live flag' };
  }

  const readonly = args.cachePolicy === 'readonly';

  if (!readonly && args.confirmSpend !== LIVE_CONFIRM_PHRASE) {
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
      cachePolicy: args.cachePolicy,
    },
  };
}
