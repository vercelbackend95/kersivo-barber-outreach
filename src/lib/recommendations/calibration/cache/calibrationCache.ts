import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { containsSecretLikeContent, sanitizePayloadForCache } from '../reporting/sanitizeReport';

export const CACHE_FORMAT_VERSION = 1;

export type CacheProducerKind = 'OPENAI_LIVE' | 'TEST_MOCK' | 'UNKNOWN_LEGACY';

export type CalibrationCacheKey = {
  entityId: string;
  contentHash: string;
  modelId: string;
  promptVersion: string;
  taxonomyVersion: string;
  schemaVersion: string;
  operation: 'classify_service' | 'classify_product' | 'rerank';
};

export type CalibrationCacheEntry = {
  key: string;
  storedAt: string;
  schemaVersion: string;
  promptVersion: string;
  taxonomyVersion: string;
  modelId: string;
  operation: CalibrationCacheKey['operation'];
  payload: unknown;
  cacheFormatVersion?: number;
  producerKind?: CacheProducerKind;
  producingRunId?: string;
};

export type WriteCalibrationCacheOptions = {
  producerKind: 'OPENAI_LIVE' | 'TEST_MOCK';
  producingRunId: string;
};

export function buildCacheKeyString(key: CalibrationCacheKey): string {
  return [
    key.entityId,
    key.contentHash,
    key.modelId,
    key.promptVersion,
    key.taxonomyVersion,
    key.schemaVersion,
    key.operation,
  ].join(':');
}

export function getCacheFilePath(baseDir: string, key: CalibrationCacheKey): string {
  const keyString = buildCacheKeyString(key);
  const digest = createHash('sha256').update(keyString).digest('hex');
  return join(baseDir, `${digest}.json`);
}

function validateCacheEntry(entry: CalibrationCacheEntry, key: CalibrationCacheKey): boolean {
  if (entry.key !== buildCacheKeyString(key)) return false;
  if (entry.schemaVersion !== key.schemaVersion) return false;
  if (entry.promptVersion !== key.promptVersion) return false;
  if (entry.taxonomyVersion !== key.taxonomyVersion) return false;
  if (entry.modelId !== key.modelId) return false;
  if (entry.operation !== key.operation) return false;
  if (entry.payload == null || typeof entry.payload !== 'object') return false;
  return true;
}

/** Resolve provenance for reporting; missing fields → UNKNOWN_LEGACY (not connectivity proof). */
export function resolveCacheProducerKind(entry: CalibrationCacheEntry): CacheProducerKind {
  if (
    entry.producerKind === 'OPENAI_LIVE' ||
    entry.producerKind === 'TEST_MOCK' ||
    entry.producerKind === 'UNKNOWN_LEGACY'
  ) {
    return entry.producerKind;
  }
  return 'UNKNOWN_LEGACY';
}

export async function readCalibrationCacheEntry(
  baseDir: string,
  key: CalibrationCacheKey,
): Promise<CalibrationCacheEntry | null> {
  const filePath = getCacheFilePath(baseDir, key);
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CalibrationCacheEntry;
    if (!validateCacheEntry(parsed, key)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readCalibrationCache(
  baseDir: string,
  key: CalibrationCacheKey,
): Promise<unknown | null> {
  const entry = await readCalibrationCacheEntry(baseDir, key);
  return entry?.payload ?? null;
}

export async function writeCalibrationCache(
  baseDir: string,
  key: CalibrationCacheKey,
  payload: unknown,
  options: WriteCalibrationCacheOptions,
): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  const sanitizedPayload = sanitizePayloadForCache(payload);
  const entry: CalibrationCacheEntry = {
    key: buildCacheKeyString(key),
    storedAt: new Date().toISOString(),
    schemaVersion: key.schemaVersion,
    promptVersion: key.promptVersion,
    taxonomyVersion: key.taxonomyVersion,
    modelId: key.modelId,
    operation: key.operation,
    payload: sanitizedPayload,
    cacheFormatVersion: CACHE_FORMAT_VERSION,
    producerKind: options.producerKind,
    producingRunId: options.producingRunId,
  };
  const serialized = JSON.stringify(entry, null, 2);
  if (containsSecretLikeContent(serialized)) {
    throw new Error('Refusing to cache content that may contain API keys');
  }

  const filePath = getCacheFilePath(baseDir, key);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, serialized, 'utf8');
  await rename(tempPath, filePath);
}
