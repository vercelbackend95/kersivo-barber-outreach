export const LANDING_DEMO_BARBER_AVATARS = {
  jamie: '/images/landing-demo/barbers/jamie.webp',
  alex: '/images/landing-demo/barbers/alex.webp',
  sam: '/images/landing-demo/barbers/sam.webp',
  marcus: '/images/landing-demo/barbers/marcus.webp',
} as const;

export const LANDING_DEMO_BARBER_AVATAR_LIST = [
  LANDING_DEMO_BARBER_AVATARS.jamie,
  LANDING_DEMO_BARBER_AVATARS.alex,
  LANDING_DEMO_BARBER_AVATARS.sam,
  LANDING_DEMO_BARBER_AVATARS.marcus,
] as const;

export const LANDING_DEMO_CLIENT_AVATARS = [
  '/images/landing-demo/clients/01.webp',
  '/images/landing-demo/clients/02.webp',
  '/images/landing-demo/clients/03.webp',
  '/images/landing-demo/clients/04.webp',
  '/images/landing-demo/clients/05.webp',
  '/images/landing-demo/clients/06.webp',
  '/images/landing-demo/clients/07.webp',
  '/images/landing-demo/clients/08.webp',
  '/images/landing-demo/clients/09.webp',
  '/images/landing-demo/clients/10.webp',
  '/images/landing-demo/clients/11.webp',
  '/images/landing-demo/clients/12.webp',
] as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function landingDemoClientAvatarForSeed(seedId: string): string {
  const index = hashSeed(seedId) % LANDING_DEMO_CLIENT_AVATARS.length;
  return LANDING_DEMO_CLIENT_AVATARS[index]!;
}

export function landingDemoBarberAvatarByIndex(index: number): string {
  const normalized = ((index % LANDING_DEMO_BARBER_AVATAR_LIST.length) + LANDING_DEMO_BARBER_AVATAR_LIST.length)
    % LANDING_DEMO_BARBER_AVATAR_LIST.length;
  return LANDING_DEMO_BARBER_AVATAR_LIST[normalized]!;
}

export function enrichLandingBarberAvatar(
  avatarUrl: string | null | undefined,
  index: number,
): string | null {
  const trimmed = avatarUrl?.trim() ?? '';
  if (!trimmed || trimmed.startsWith('data:')) {
    return landingDemoBarberAvatarByIndex(index);
  }
  return trimmed;
}
