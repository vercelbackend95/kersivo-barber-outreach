import { describe, expect, it } from 'vitest';
import type { PreviewRequestStatus } from '@prisma/client';
import {
  BUILD_PROGRESS_STAGE_IDS,
  mapHubStageToBuildStage,
  mapPreviewStatusToBuildStage,
  websiteBuildProgress,
  websiteBuildProgressFromHubStage,
} from './buildProgress';
import { ADMIN_HUB_BUILD_COPY, ADMIN_HUB_BUILD_STAGES } from './copy';
import type { HubStage } from '@/lib/freePreview/hubStage';

const AUDIT_STATUSES: PreviewRequestStatus[] = [
  'REQUESTED',
  'IN_PROGRESS',
  'READY',
  'CHANGES_REQUESTED',
  'CONVERTED',
  'DECLINED',
  'EXPIRED',
  'REJECTED',
];

describe('mapPreviewStatusToBuildStage', () => {
  it('maps every audit PreviewRequestStatus onto the five stages or null', () => {
    expect(mapPreviewStatusToBuildStage('REQUESTED')).toBe('requested');
    expect(mapPreviewStatusToBuildStage('IN_PROGRESS')).toBe('designing');
    expect(mapPreviewStatusToBuildStage('READY')).toBe('review');
    expect(mapPreviewStatusToBuildStage('CHANGES_REQUESTED')).toBe('review');
    expect(mapPreviewStatusToBuildStage('CONVERTED')).toBe('launch');
    expect(mapPreviewStatusToBuildStage('CONVERTED', null)).toBe('launch');
    expect(mapPreviewStatusToBuildStage('CONVERTED', new Date('2026-11-01'))).toBe('live');
    expect(mapPreviewStatusToBuildStage('DECLINED')).toBeNull();
    expect(mapPreviewStatusToBuildStage('EXPIRED')).toBeNull();
    expect(mapPreviewStatusToBuildStage('REJECTED')).toBeNull();
    expect(AUDIT_STATUSES).toHaveLength(8);
  });

  it('keeps HubStage in lock-step with the status map for the five bar stages', () => {
    const pairs: Array<[HubStage, PreviewRequestStatus, Date | null]> = [
      ['requested', 'REQUESTED', null],
      ['designing', 'IN_PROGRESS', null],
      ['review', 'READY', null],
      ['review', 'CHANGES_REQUESTED', null],
      ['launch', 'CONVERTED', null],
      ['live', 'CONVERTED', new Date('2026-11-01')],
    ];
    for (const [hub, status, liveAt] of pairs) {
      expect(mapHubStageToBuildStage(hub)).toBe(mapPreviewStatusToBuildStage(status, liveAt));
    }
    expect(mapHubStageToBuildStage('declined')).toBeNull();
    expect(mapHubStageToBuildStage('expired')).toBeNull();
  });
});

describe('websiteBuildProgress', () => {
  it('builds five markers, fill, British copy and Step X of 5 text', () => {
    expect(BUILD_PROGRESS_STAGE_IDS).toEqual(['requested', 'designing', 'review', 'launch', 'live']);
    expect(ADMIN_HUB_BUILD_STAGES).toEqual(['Requested', 'Designing', 'Review', 'Launch', 'Live']);

    const review = websiteBuildProgress('review');
    expect(review.currentIndex).toBe(2);
    expect(review.total).toBe(5);
    expect(review.fillPercent).toBe(50);
    expect(review.copy).toBe(ADMIN_HUB_BUILD_COPY.review);
    expect(review.stepOf).toBe('Step 3 of 5');
    expect(review.stepSr).toBe('Step 3 of 5: Review');
    expect(review.steps.map((step) => [step.label, step.marker])).toEqual([
      ['Requested', 'complete'],
      ['Designing', 'complete'],
      ['Review', 'current'],
      ['Launch', 'upcoming'],
      ['Live', 'upcoming'],
    ]);

    expect(websiteBuildProgress('requested')).toMatchObject({
      fillPercent: 0,
      copy: ADMIN_HUB_BUILD_COPY.requested,
      stepOf: 'Step 1 of 5',
    });
    expect(websiteBuildProgress('designing').copy).toBe(ADMIN_HUB_BUILD_COPY.designing);
    expect(websiteBuildProgress('launch').fillPercent).toBe(75);
    expect(websiteBuildProgress('live')).toMatchObject({
      fillPercent: 100,
      copy: ADMIN_HUB_BUILD_COPY.live,
      stepOf: 'Step 5 of 5',
    });
    expect(websiteBuildProgressFromHubStage('review')?.stage).toBe('review');
    expect(websiteBuildProgressFromHubStage('expired')).toBeNull();
  });
});
