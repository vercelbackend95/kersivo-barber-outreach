import { config as dotenvConfig } from 'dotenv';

import { createCalibrationOpenAiClient } from '../../ai/calibrationClient';
import { loadCalibrationCatalogue } from '../dataset/loaders';
import { loadCalibrationEnv } from '../env/loadCalibrationEnv';
import { parseCalibrationArgv, validateLiveActivation } from '../liveGuards';
import { createCalibrationProvider } from '../provider/createCalibrationProvider';
import { buildLiveSmokeCallPlan } from '../runner/buildLiveCallPlan';
import { runCalibration } from '../runner/runCalibration';
import type { CalibrationCliArgs } from '../types';

export type CalibrationCliDeps = {
  loadEnv: typeof loadCalibrationEnv;
  createClient: typeof createCalibrationOpenAiClient;
  createProvider: typeof createCalibrationProvider;
  runCalibration: typeof runCalibration;
  exit: (code: number) => void;
  log: typeof console.log;
  logError: typeof console.error;
  repoRoot?: string;
};

const defaultDeps: CalibrationCliDeps = {
  loadEnv: loadCalibrationEnv,
  createClient: createCalibrationOpenAiClient,
  createProvider: createCalibrationProvider,
  runCalibration,
  exit: (code) => process.exit(code),
  log: console.log.bind(console),
  logError: console.error.bind(console),
};

function defaultDotenvLoader(path: string): void {
  dotenvConfig({ path, override: false });
}

export async function runCalibrationCli(
  argv: string[],
  deps: CalibrationCliDeps = defaultDeps,
): Promise<number> {
  const parsed = parseCalibrationArgv(argv);
  if (!parsed.ok) {
    deps.logError(`Calibration blocked: ${parsed.code} — ${parsed.message}`);
    return 1;
  }

  const args = parsed.args;

  if (args.mode === 'live') {
    const activation = validateLiveActivation(args);
    if (!activation.ok) {
      deps.logError(`Calibration blocked: ${activation.code} — ${activation.message}`);
      return 1;
    }

    const catalogue = loadCalibrationCatalogue();
    buildLiveSmokeCallPlan(catalogue, activation.args.model);

    const liveArgs: CalibrationCliArgs = {
      ...args,
      model: activation.args.model,
      maxCalls: activation.args.maxCalls,
      maxCostUsd: activation.args.maxCostUsd,
      scope: activation.args.scope,
      outputDir: activation.args.outputDir,
      cachePolicy: activation.args.cachePolicy,
    };

    if (args.cachePolicy === 'readonly') {
      try {
        const result = await deps.runCalibration(liveArgs, { liveDeps: {} });
        deps.log(result.planSummary ?? 'Live calibration complete.');
        deps.log(`Report written to ${liveArgs.outputDir}/calibration-report.json`);
        return result.exitCode;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        deps.logError(`Calibration failed: ${message}`);
        return 1;
      }
    }

    let env;
    try {
      env = deps.loadEnv({
        loadDotenvFile: defaultDotenvLoader,
        repoRoot: deps.repoRoot ?? process.cwd(),
      });
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error
          ? String((error as { code: string }).code)
          : 'OPENAI_API_KEY_MISSING';
      deps.logError(`Calibration blocked: ${code}`);
      return 1;
    }

    const client = deps.createClient(env.apiKey);
    const provider = deps.createProvider({ client, modelId: activation.args.model });

    try {
      const result = await deps.runCalibration(liveArgs, {
        liveDeps: { provider, cacheProducerKind: 'OPENAI_LIVE' },
      });
      deps.log(result.planSummary ?? 'Live calibration complete.');
      deps.log(`Report written to ${liveArgs.outputDir}/calibration-report.json`);
      return result.exitCode;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.logError(`Calibration failed: ${message}`);
      return 1;
    }
  }

  try {
    const result = await deps.runCalibration(args);
    deps.log(result.planSummary ?? 'Calibration complete.');
    deps.log(`Report written to ${args.outputDir}/calibration-report.json`);
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logError(`Calibration failed: ${message}`);
    return 1;
  }
}
