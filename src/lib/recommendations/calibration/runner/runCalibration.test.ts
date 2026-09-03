import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as classifyModule from '../../ai/classify';
import { runCalibration } from './runCalibration';

describe('runCalibration dry-run', () => {
  it('makes zero OpenAI classify or rerank calls', async () => {
    const classifySpy = vi.spyOn(classifyModule, 'classifyServiceEntity');
    const productSpy = vi.spyOn(classifyModule, 'classifyProductEntity');
    const rerankSpy = vi.spyOn(classifyModule, 'rerankEligibleCandidates');
    const clientSpy = vi.spyOn(classifyModule, 'createRecommendationOpenAiClient');

    const outputDir = await mkdtemp(join(tmpdir(), 'cal-out-'));
    try {
      const result = await runCalibration({
        mode: 'dry-run',
        scope: 'full',
        outputDir,
      });

      expect(result.report.mode).toBe('dry-run');
      expect(result.report.calls.attempted).toBe(0);
      expect(result.report.liveEvaluationStatus).toBe('NOT_RUN');
      expect(result.report.releaseGateStatus).toBe('NOT_RUN');
      expect(result.report.harnessSelfCheckStatus).toBe('PASSED');
      expect(result.report.classificationMetrics.structuredParseSuccessRate).toBeNull();
      expect(result.report.recommendationMetrics.precisionAt4).toBeNull();
      expect(result.report.harnessFixtureMetrics.precisionAt4).toBeGreaterThanOrEqual(0.95);
      expect(result.report.promptVersion).toBe('2026-09-v4');
      expect(result.report.scenarioDiagnostics.length).toBeGreaterThan(0);
      expect(result.exitCode).toBe(0);
      expect(classifySpy).not.toHaveBeenCalled();
      expect(productSpy).not.toHaveBeenCalled();
      expect(rerankSpy).not.toHaveBeenCalled();
      expect(clientSpy).not.toHaveBeenCalled();
    } finally {
      classifySpy.mockRestore();
      productSpy.mockRestore();
      rerankSpy.mockRestore();
      clientSpy.mockRestore();
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
