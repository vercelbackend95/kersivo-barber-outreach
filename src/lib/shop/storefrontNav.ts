export type StorefrontNavItem = {
  href: string;
  label: string;
};

export type StorefrontHeaderThemeId = 'blackline' | 'kersivo';

function normalizePath(pathname: string): string {
  const path = pathname.split('#')[0]?.split('?')[0] || pathname;
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path || '/';
}

export function formatNavIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function isStorefrontNavActive(pathname: string, href: string, homeHref: string): boolean {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  const home = normalizePath(homeHref);
  if (target === home) {
    return current === home;
  }
  return current === target || current.startsWith(`${target}/`);
}
