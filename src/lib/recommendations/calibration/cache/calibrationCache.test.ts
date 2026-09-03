import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildCacheKeyString,
  getCacheFilePath,
  readCalibrationCache,
  writeCalibrationCache,
  type CalibrationCacheKey,
} from './calibrationCache';

const baseKey: CalibrationCacheKey = {
  entityId: 'cal-svc-skin-fade',
  contentHash: 'abc123',
  modelId: 'gpt-4o-mini-2024-07-18',
  promptVersion: '2026-09-v4',
  taxonomyVersion: '2026-09-v2',
  schemaVersion: '2',
  operation: 'classify_service',
};

describe('calibration cache', () => {
  it('writes and reads cache entries atomically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      const payload = { targetAreas: ['HAIR'], confidence: 0.9 };
      await writeCalibrationCache(dir, baseKey, payload);
      const cached = await readCalibrationCache(dir, baseKey);
      expect(cached).toEqual(payload);
      const raw = await readFile(getCacheFilePath(dir, baseKey), 'utf8');
      expect(raw).not.toMatch(/sk-proj-/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invalidates on content hash change', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      await writeCalibrationCache(dir, baseKey, { ok: true });
      const miss = await readCalibrationCache(dir, { ...baseKey, contentHash: 'different-hash' });
      expect(miss).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invalidates when v3 cache entry is read under v4 key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      const v3Key = { ...baseKey, promptVersion: '2026-09-v3' };
      await writeCalibrationCache(dir, v3Key, { ok: true });
      expect(await readCalibrationCache(dir, baseKey)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invalidates on model, prompt, taxonomy, schema, and operation changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      await writeCalibrationCache(dir, baseKey, { ok: true });
      expect(await readCalibrationCache(dir, { ...baseKey, modelId: 'other-model' })).toBeNull();
      expect(await readCalibrationCache(dir, { ...baseKey, promptVersion: 'other' })).toBeNull();
      expect(await readCalibrationCache(dir, { ...baseKey, taxonomyVersion: 'other' })).toBeNull();
      expect(await readCalibrationCache(dir, { ...baseKey, schemaVersion: '9' })).toBeNull();
      expect(await readCalibrationCache(dir, { ...baseKey, operation: 'rerank' })).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('treats corrupt cache files as misses', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      const filePath = getCacheFilePath(dir, baseKey);
      await writeFile(filePath, '{ not valid json', 'utf8');
      expect(await readCalibrationCache(dir, baseKey)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('treats wrong-version envelope as miss', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      const filePath = getCacheFilePath(dir, baseKey);
      await writeFile(
        filePath,
        JSON.stringify({
          key: buildCacheKeyString(baseKey),
          storedAt: new Date().toISOString(),
          schemaVersion: 'wrong',
          promptVersion: baseKey.promptVersion,
          taxonomyVersion: baseKey.taxonomyVersion,
          modelId: baseKey.modelId,
          operation: baseKey.operation,
          payload: { ok: true },
        }),
        'utf8',
      );
      expect(await readCalibrationCache(dir, baseKey)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('sanitizes secret-like content before cache write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      await writeCalibrationCache(dir, baseKey, { token: 'sk-proj-fake-example-key' });
      const raw = await readFile(getCacheFilePath(dir, baseKey), 'utf8');
      expect(raw).not.toMatch(/sk-proj-fake/);
      expect(raw).toContain('[REDACTED]');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
