import { describe, expect, it, vi } from 'vitest';

import { CalibrationEnvLoadError, loadCalibrationEnv } from './loadCalibrationEnv';

describe('loadCalibrationEnv', () => {
  it('returns api key when present in env', () => {
    const env = loadCalibrationEnv({ env: { OPENAI_API_KEY: 'test-key-value' } });
    expect(env.apiKey).toBe('test-key-value');
  });

  it('loads dotenv file when key absent from env', () => {
    const mutableEnv: NodeJS.ProcessEnv = {};
    const loadDotenvFile = vi.fn((path: string) => {
      expect(path).toContain('.env');
      mutableEnv.OPENAI_API_KEY = 'from-dotenv';
    });
    const env = loadCalibrationEnv({ env: mutableEnv, loadDotenvFile, repoRoot: '/repo' });
    expect(env.apiKey).toBe('from-dotenv');
    expect(loadDotenvFile).toHaveBeenCalledOnce();
  });

  it('prefers existing env key over dotenv', () => {
    const loadDotenvFile = vi.fn();
    const env = loadCalibrationEnv({
      env: { OPENAI_API_KEY: 'already-set' },
      loadDotenvFile,
    });
    expect(env.apiKey).toBe('already-set');
    expect(loadDotenvFile).not.toHaveBeenCalled();
  });

  it('throws OPENAI_API_KEY_MISSING without exposing key material', () => {
    expect(() => loadCalibrationEnv({ env: {} })).toThrow(CalibrationEnvLoadError);
    try {
      loadCalibrationEnv({ env: {} });
    } catch (error) {
      expect(error).toMatchObject({ code: 'OPENAI_API_KEY_MISSING' });
      expect(String(error)).not.toContain('sk-');
    }
  });
});
