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

export type OgType = 'website' | 'product' | 'article';

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
  if (/^https?:\/\//i.test(ogImagePath)) return ogImagePath;
  return buildAbsoluteUrl(ogImagePath.startsWith('/') ? ogImagePath : `/${ogImagePath}`);
}

export type ResolvedPageSeo = ReturnType<typeof resolvePageSeo>;

/**
 * Indexable pages state snippet limits explicitly so Google, Bing and AI answer engines may quote
 * a full passage, show a large image preview and any length of video preview.
 * Without this, Google applies its default limits. Never block snippets on a public page.
 * No `index, follow` here: they are the defaults, and an `X-Robots-Tag: noindex` header (vercel.json) on a
 * route that still renders SeoHead without `noindex` must not be contradicted by the page.
 */
export const INDEXABLE_ROBOTS_CONTENT = 'max-snippet:-1, max-image-preview:large, max-video-preview:-1';

export function resolveRobotsContent(seo: Pick<PageSeo, 'noindex' | 'robotsFollow'>): string {
  if (!seo.noindex) return INDEXABLE_ROBOTS_CONTENT;
  return seo.robotsFollow ? 'noindex, follow' : 'noindex, nofollow';
}

/**
 * An indexable page without `canonicalPath` would silently canonicalise to the homepage.
 * Dev and tests fail loudly instead; production keeps the `/` fallback so a page never breaks.
 */
export function assertIndexablePageHasCanonical(seo: Pick<PageSeo, 'canonicalPath' | 'noindex'>, isDev: boolean): void {
  if (isDev && !seo.noindex && !seo.canonicalPath) {
    throw new Error('SeoHead: indexable page is missing canonicalPath (pass canonicalPath="/" for the homepage).');
  }
}

export function resolvePageSeo(seo: PageSeo = {}) {
  assertIndexablePageHasCanonical(seo, Boolean(import.meta.env?.DEV));
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
