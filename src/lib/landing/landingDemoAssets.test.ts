import { describe, expect, it } from 'vitest';
import {
  landingDemoBarberAvatarByIndex,
  landingDemoClientAvatarForSeed,
  LANDING_DEMO_CLIENT_AVATARS,
} from './landingDemoAssets';

describe('landingDemoAssets', () => {
  it('returns a stable client avatar per seed id', () => {
    const first = landingDemoClientAvatarForSeed('live-b01');
    const second = landingDemoClientAvatarForSeed('live-b01');
    const other = landingDemoClientAvatarForSeed('live-b02');

    expect(first).toBe(second);
    expect(LANDING_DEMO_CLIENT_AVATARS).toContain(first);
    expect(other).toMatch(/^\/images\/landing-demo\/clients\//);
  });

  it('cycles barber avatars by index', () => {
    expect(landingDemoBarberAvatarByIndex(0)).toMatch(/^\/images\/landing-demo\/barbers\//);
    expect(landingDemoBarberAvatarByIndex(4)).toBe(landingDemoBarberAvatarByIndex(0));
  });
});
