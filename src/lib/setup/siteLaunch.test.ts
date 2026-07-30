import { describe, it, expect } from 'vitest';
import { getSiteLaunchStatus } from './siteLaunch';

describe('getSiteLaunchStatus', () => {
  it('returns not_ready when no preview URL', () => {
    expect(getSiteLaunchStatus({})).toBe('not_ready');
    expect(getSiteLaunchStatus({ sitePreviewUrl: null })).toBe('not_ready');
    expect(getSiteLaunchStatus({ sitePreviewUrl: '' })).toBe('not_ready');
  });

  it('returns ready_for_review when URL present but not approved', () => {
    expect(
      getSiteLaunchStatus({ sitePreviewUrl: 'https://preview.example.com', sitePreviewVersion: 'v1' }),
    ).toBe('ready_for_review');
  });

  it('returns ready_for_review when approved for older version', () => {
    expect(
      getSiteLaunchStatus({
        sitePreviewUrl: 'https://preview.example.com',
        sitePreviewVersion: 'v2',
        launchApprovedAt: new Date(),
        launchApprovedVersion: 'v1',
      }),
    ).toBe('ready_for_review');
  });

  it('returns approved when version matches', () => {
    expect(
      getSiteLaunchStatus({
        sitePreviewUrl: 'https://preview.example.com',
        sitePreviewVersion: 'v1',
        launchApprovedAt: new Date(),
        launchApprovedVersion: 'v1',
      }),
    ).toBe('approved');
  });
});
