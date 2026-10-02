/** Static hero dashboard image shown instead of the live frame at phone/tablet widths. */
export const STILL_DIR = '/images/hero-dashboard';
export const STILL_SIZES = '(max-width: 48rem) calc(100vw - 0.375rem), 48rem';
export const PHONE_WIDTHS = [800, 1000, 1200, 1280, 1600] as const;
export const TABLET_WIDTHS = [840, 1260, 1680] as const;
/** Must match the tablet crop breakpoint in hero-dashboard-showcase.css. */
export const TABLET_MEDIA = '(min-width: 40.0625rem)';
/** 1×1 transparent GIF: the eager image is hidden above 48rem and must not be downloaded there. */
export const DESKTOP_BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const srcset = (name: string, widths: readonly number[], ext: string) =>
  widths.map((w) => `${STILL_DIR}/${name}-${w}.${ext} ${w}w`).join(', ');

export const phoneSrcset = (ext: 'avif' | 'webp' | 'png') => srcset('hero-dashboard-mobile', PHONE_WIDTHS, ext);
export const tabletSrcset = (ext: 'avif' | 'webp') => srcset('hero-dashboard-tablet', TABLET_WIDTHS, ext);
