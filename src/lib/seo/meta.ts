import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE_PATH, DEFAULT_TITLE } from './defaults';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export type PageSeo = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImagePath?: string;
  noindex?: boolean;
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

export function resolvePageSeo(seo: PageSeo = {}) {
  const title = seo.title ?? DEFAULT_TITLE;
  const description = seo.description ?? DEFAULT_DESCRIPTION;
  const canonicalPath = seo.canonicalPath ?? '/';
  const canonical = resolveCanonicalUrl(canonicalPath);
  const ogImage = resolveOgImageUrl(seo.ogImagePath);

  return {
    title,
    description,
    canonicalPath,
    canonical,
    ogImage,
    noindex: seo.noindex ?? false,
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
