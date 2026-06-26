const DEFAULT_PUBLIC_SITE_URL = 'https://kersivo.co.uk';

export function getPublicSiteUrl(): string {
  const configured = (import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return DEFAULT_PUBLIC_SITE_URL;
}
