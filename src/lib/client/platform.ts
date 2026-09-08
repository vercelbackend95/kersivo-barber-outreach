export type ClientPlatform = 'IOS' | 'ANDROID' | 'OTHER_MOBILE' | 'DESKTOP';

export type PlatformNavigatorLike = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  } | null;
};

function readUa(nav: PlatformNavigatorLike): string {
  return typeof nav.userAgent === 'string' ? nav.userAgent : '';
}

function readPlatform(nav: PlatformNavigatorLike): string {
  return typeof nav.platform === 'string' ? nav.platform : '';
}

function isIpadOsAsMac(nav: PlatformNavigatorLike): boolean {
  return readPlatform(nav) === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

function isIosUa(ua: string): boolean {
  return /iPhone|iPod|iPad/i.test(ua);
}

function isAndroidUa(ua: string): boolean {
  return /Android/i.test(ua);
}

function isOtherMobileUa(ua: string): boolean {
  return /Mobile|Mobi|Tablet|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Resolve the client platform for calendar auto-routing.
 * SSR-safe: returns DESKTOP when `window`/`navigator` are unavailable.
 * Accepts an optional navigator override for tests.
 */
export function resolveClientPlatform(nav?: PlatformNavigatorLike | null): ClientPlatform {
  if (typeof window === 'undefined' && nav == null) {
    return 'DESKTOP';
  }

  const source: PlatformNavigatorLike | null =
    nav ?? (typeof navigator !== 'undefined' ? (navigator as PlatformNavigatorLike) : null);

  if (!source) {
    return 'DESKTOP';
  }

  const ua = readUa(source);
  const platform = readPlatform(source);
  const uaData = source.userAgentData;

  if (uaData && typeof uaData === 'object') {
    const dataPlatform = typeof uaData.platform === 'string' ? uaData.platform.toLowerCase() : '';
    const mobile = Boolean(uaData.mobile);

    if (/ios|iphone|ipad/i.test(dataPlatform) || (mobile && isIosUa(ua))) {
      return 'IOS';
    }
    if (/android/i.test(dataPlatform) || (mobile && isAndroidUa(ua))) {
      return 'ANDROID';
    }
    if (mobile) {
      if (isIosUa(ua) || isIpadOsAsMac(source)) return 'IOS';
      if (isAndroidUa(ua)) return 'ANDROID';
      return 'OTHER_MOBILE';
    }
    // userAgentData present and not mobile → still check iPadOS-as-Mac and UA fallbacks below
  }

  if (isIosUa(ua) || isIpadOsAsMac(source)) {
    return 'IOS';
  }
  if (isAndroidUa(ua)) {
    return 'ANDROID';
  }
  if (isOtherMobileUa(ua) && !/Windows NT|Macintosh|Linux x86_64|CrOS/i.test(ua)) {
    return 'OTHER_MOBILE';
  }
  if (/Windows Phone|IEMobile/i.test(ua)) {
    return 'OTHER_MOBILE';
  }

  // Desktop platforms
  if (/Win|Mac|Linux|CrOS/i.test(platform) || /Windows NT|Macintosh|X11|CrOS/i.test(ua)) {
    return 'DESKTOP';
  }

  if (!ua && !platform) {
    return 'DESKTOP';
  }

  return 'DESKTOP';
}
