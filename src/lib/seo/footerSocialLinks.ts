export const KERSIVO_CONTACT_EMAIL = 'hello@kersivo.co.uk';

const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/kersivo.barber/';
const DEFAULT_TIKTOK_URL = 'https://www.tiktok.com/@kersivo';
const DEFAULT_FACEBOOK_URL =
  'https://www.facebook.com/profile.php?id=61570721186194';

export const INSTAGRAM_URL =
  (import.meta.env.PUBLIC_INSTAGRAM_URL ?? process.env.PUBLIC_INSTAGRAM_URL ?? '').trim() ||
  DEFAULT_INSTAGRAM_URL;

export const TIKTOK_URL =
  (import.meta.env.PUBLIC_TIKTOK_URL ?? process.env.PUBLIC_TIKTOK_URL ?? '').trim() ||
  DEFAULT_TIKTOK_URL;

export const FACEBOOK_URL =
  (import.meta.env.PUBLIC_FACEBOOK_URL ?? process.env.PUBLIC_FACEBOOK_URL ?? '').trim() ||
  DEFAULT_FACEBOOK_URL;

export const FOOTER_LEGAL_LINKS = {
  privacy: { name: 'Privacy Policy', href: '/privacy' },
  cookies: { name: 'Cookie Policy', href: '/cookies' },
  cookieSettings: { name: 'Cookie settings', href: '#cookie-settings' },
  terms: { name: 'Terms', href: '/terms' },
  termsAndCancellation: { name: 'Terms & Cancellation', href: '/terms#setup-deposits' },
} as const;

export type FooterSocialPlatform = 'instagram' | 'tiktok' | 'facebook';

export type FooterNavItem = {
  name: string;
  href: string;
};

export type FooterSocialLink = FooterNavItem & {
  id: FooterSocialPlatform;
};

export function getFooterSocialLinks(): FooterSocialLink[] {
  return [
    { id: 'instagram', name: 'Instagram', href: INSTAGRAM_URL },
    { id: 'tiktok', name: 'TikTok', href: TIKTOK_URL },
    { id: 'facebook', name: 'Facebook', href: FACEBOOK_URL },
  ];
}
