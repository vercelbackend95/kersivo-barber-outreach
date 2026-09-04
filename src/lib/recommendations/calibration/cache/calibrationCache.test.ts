import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildCacheKeyString,
  getCacheFilePath,
  readCalibrationCache,
  readCalibrationCacheEntry,
  resolveCacheProducerKind,
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

const WRITE_OPTS = { producerKind: 'TEST_MOCK' as const, producingRunId: 'test-run' };

describe('calibration cache', () => {
  it('writes and reads cache entries atomically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      const payload = { targetAreas: ['HAIR'], confidence: 0.9 };
      await writeCalibrationCache(dir, baseKey, payload, WRITE_OPTS);
      const cached = await readCalibrationCache(dir, baseKey);
      expect(cached).toEqual(payload);
      const raw = await readFile(getCacheFilePath(dir, baseKey), 'utf8');
      expect(raw).not.toMatch(/sk-proj-/);
      expect(raw).toContain('"producerKind": "TEST_MOCK"');
      expect(raw).toContain('"cacheFormatVersion": 1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invalidates on content hash change', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      await writeCalibrationCache(dir, baseKey, { ok: true }, WRITE_OPTS);
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
      await writeCalibrationCache(dir, v3Key, { ok: true }, WRITE_OPTS);
      expect(await readCalibrationCache(dir, baseKey)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invalidates on model, prompt, taxonomy, schema, and operation changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      await writeCalibrationCache(dir, baseKey, { ok: true }, WRITE_OPTS);
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
      await writeCalibrationCache(dir, baseKey, { token: 'sk-proj-fake-example-key' }, WRITE_OPTS);
      const raw = await readFile(getCacheFilePath(dir, baseKey), 'utf8');
      expect(raw).not.toMatch(/sk-proj-fake/);
      expect(raw).toContain('[REDACTED]');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves missing provenance as UNKNOWN_LEGACY without rewriting', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      const filePath = getCacheFilePath(dir, baseKey);
      await writeFile(
        filePath,
        JSON.stringify({
          key: buildCacheKeyString(baseKey),
          storedAt: new Date().toISOString(),
          schemaVersion: baseKey.schemaVersion,
          promptVersion: baseKey.promptVersion,
          taxonomyVersion: baseKey.taxonomyVersion,
          modelId: baseKey.modelId,
          operation: baseKey.operation,
          payload: { ok: true },
        }),
        'utf8',
      );
      const entry = await readCalibrationCacheEntry(dir, baseKey);
      expect(entry).not.toBeNull();
      expect(resolveCacheProducerKind(entry!)).toBe('UNKNOWN_LEGACY');
      const rawAfter = await readFile(filePath, 'utf8');
      expect(rawAfter).not.toContain('producerKind');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('never labels mock writes as OPENAI_LIVE', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cal-cache-'));
    try {
      await writeCalibrationCache(dir, baseKey, { ok: true }, WRITE_OPTS);
      const entry = await readCalibrationCacheEntry(dir, baseKey);
      expect(entry?.producerKind).toBe('TEST_MOCK');
      expect(entry?.producerKind).not.toBe('OPENAI_LIVE');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
