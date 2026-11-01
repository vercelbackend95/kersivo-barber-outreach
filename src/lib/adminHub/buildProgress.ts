/**
 * Owner-facing 5-stage website-build bar.
 * Maps existing PreviewRequestStatus values (docs/preview-hub/BATCH_0_FINDINGS.md).
 * Does not add database statuses.
 */
import type { PreviewRequestStatus } from '@prisma/client';
import type { HubStage } from '@/lib/freePreview/hubStage';
import {
  ADMIN_HUB_BUILD_COPY,
  ADMIN_HUB_BUILD_STAGES,
  ADMIN_HUB_BUILD_STEP_OF,
  ADMIN_HUB_BUILD_STEP_SR,
} from './copy';

export const BUILD_PROGRESS_STAGE_IDS = ['requested', 'designing', 'review', 'launch', 'live'] as const;
export type BuildProgressStageId = (typeof BUILD_PROGRESS_STAGE_IDS)[number];
export type BuildProgressMarker = 'complete' | 'current' | 'upcoming';

export type BuildProgressStep = {
  id: BuildProgressStageId;
  label: (typeof ADMIN_HUB_BUILD_STAGES)[number];
  marker: BuildProgressMarker;
  index: number;
};

export type BuildProgress = {
  stage: BuildProgressStageId;
  currentIndex: number;
  total: number;
  fillPercent: number;
  copy: string;
  stepOf: string;
  stepSr: string;
  steps: BuildProgressStep[];
};

const STAGE_FROM_STATUS: Record<PreviewRequestStatus, BuildProgressStageId | null> = {
  REQUESTED: 'requested',
  IN_PROGRESS: 'designing',
  READY: 'review',
  CHANGES_REQUESTED: 'review',
  CONVERTED: 'launch',
  DECLINED: null,
  EXPIRED: null,
  REJECTED: null,
};

/**
 * Maps an existing PreviewRequestStatus onto the five bar stages.
 * CONVERTED uses liveAt to choose Launch vs Live.
 * DECLINED, EXPIRED and REJECTED return null — they are not bar stages.
 */
export function mapPreviewStatusToBuildStage(
  status: PreviewRequestStatus,
  liveAt: Date | string | null = null,
): BuildProgressStageId | null {
  if (status === 'CONVERTED') return liveAt ? 'live' : 'launch';
  return STAGE_FROM_STATUS[status];
}

export function mapHubStageToBuildStage(stage: HubStage): BuildProgressStageId | null {
  if (
    stage === 'requested' ||
    stage === 'designing' ||
    stage === 'review' ||
    stage === 'launch' ||
    stage === 'live'
  ) {
    return stage;
  }
  return null;
}

export function websiteBuildProgress(stage: BuildProgressStageId): BuildProgress {
  const currentIndex = BUILD_PROGRESS_STAGE_IDS.indexOf(stage);
  const total = BUILD_PROGRESS_STAGE_IDS.length;
  const label = ADMIN_HUB_BUILD_STAGES[currentIndex]!;
  const last = total - 1;
  return {
    stage,
    currentIndex,
    total,
    fillPercent: last <= 0 ? 100 : (currentIndex / last) * 100,
    copy: ADMIN_HUB_BUILD_COPY[stage],
    stepOf: ADMIN_HUB_BUILD_STEP_OF(currentIndex + 1, total),
    stepSr: ADMIN_HUB_BUILD_STEP_SR(currentIndex + 1, total, label),
    steps: BUILD_PROGRESS_STAGE_IDS.map((id, index) => ({
      id,
      label: ADMIN_HUB_BUILD_STAGES[index]!,
      marker: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
      index,
    })),
  };
}

export function websiteBuildProgressFromHubStage(stage: HubStage): BuildProgress | null {
  const mapped = mapHubStageToBuildStage(stage);
  return mapped ? websiteBuildProgress(mapped) : null;
}
