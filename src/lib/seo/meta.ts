import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_TITLE,
} from './defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { getTwitterHandle } from './socialProfiles';

export type OgType = 'website' | 'product';

export type PageSeo = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImagePath?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  ogImageAlt?: string;
  ogType?: OgType;
  noindex?: boolean;
  /** When noindex is true, emit `noindex, follow` instead of `noindex, nofollow`. */
  robotsFollow?: boolean;
};

export function buildAbsoluteUrl(path: string): string {
  const siteUrl = getPublicSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

export function resolveCanonicalUrl(canonicalPath: string): string {
  const path = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  return buildAbsoluteUrl(path);
}

export function resolveOgImageUrl(ogImagePath: string = DEFAULT_OG_IMAGE_PATH): string {
  return buildAbsoluteUrl(ogImagePath);
}

export type ResolvedPageSeo = ReturnType<typeof resolvePageSeo>;

export function resolveRobotsContent(seo: Pick<PageSeo, 'noindex' | 'robotsFollow'>): string | undefined {
  if (!seo.noindex) return undefined;
  return seo.robotsFollow ? 'noindex, follow' : 'noindex, nofollow';
}

export function resolvePageSeo(seo: PageSeo = {}) {
  const title = seo.title ?? DEFAULT_TITLE;
  const description = seo.description ?? DEFAULT_DESCRIPTION;
  const canonicalPath = seo.canonicalPath ?? '/';
  const canonical = resolveCanonicalUrl(canonicalPath);
  const ogImagePath = seo.ogImagePath ?? DEFAULT_OG_IMAGE_PATH;
  const ogImage = resolveOgImageUrl(ogImagePath);
  const ogImageWidth = seo.ogImageWidth ?? DEFAULT_OG_IMAGE_WIDTH;
  const ogImageHeight = seo.ogImageHeight ?? DEFAULT_OG_IMAGE_HEIGHT;
  const ogImageAlt = seo.ogImageAlt ?? DEFAULT_OG_IMAGE_ALT;
  const ogType = seo.ogType ?? 'website';
  const twitterHandle = getTwitterHandle();
  const noindex = seo.noindex ?? false;
  const robotsFollow = seo.robotsFollow ?? false;

  return {
    title,
    description,
    canonicalPath,
    canonical,
    ogImagePath,
    ogImage,
    ogImageWidth,
    ogImageHeight,
    ogImageAlt,
    ogType,
    twitterHandle,
    noindex,
    robotsFollow,
    robotsContent: resolveRobotsContent({ noindex, robotsFollow }),
  };
}

export function getGoogleSiteVerification(): string | undefined {
  const value = (
    import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION ??
    process.env.PUBLIC_GOOGLE_SITE_VERIFICATION ??
    ''
  ).trim();
  return value || undefined;
}
