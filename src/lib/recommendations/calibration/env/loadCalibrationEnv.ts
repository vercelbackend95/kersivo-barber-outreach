import { join } from 'node:path';

export type CalibrationEnv = {
  apiKey: string;
};

export type CalibrationEnvError = {
  code: string;
  message: string;
};

export type LoadCalibrationEnvDeps = {
  env?: NodeJS.ProcessEnv;
  loadDotenvFile?: (path: string) => void;
  repoRoot?: string;
};

export class CalibrationEnvLoadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CalibrationEnvLoadError';
  }
}

function readApiKey(env: NodeJS.ProcessEnv): string | undefined {
  const raw = env.OPENAI_API_KEY;
  if (!raw || raw.trim().length === 0) return undefined;
  return raw.trim();
}

export function loadCalibrationEnv(deps: LoadCalibrationEnvDeps = {}): CalibrationEnv {
  const env = deps.env ?? process.env;
  const existing = readApiKey(env);
  if (existing) {
    return { apiKey: existing };
  }

  if (deps.loadDotenvFile) {
    const repoRoot = deps.repoRoot ?? process.cwd();
    deps.loadDotenvFile(join(repoRoot, '.env'));
    const afterDotenv = readApiKey(env);
    if (afterDotenv) {
      return { apiKey: afterDotenv };
    }
  }

  throw new CalibrationEnvLoadError('OPENAI_API_KEY_MISSING', 'OPENAI_API_KEY_MISSING');
}
