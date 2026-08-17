export type RouteFamily = 'marketing' | 'minimal' | 'demo' | 'other';

export type RouteTransitionVariant = 'marketing' | 'dashboard' | 'flow' | 'themed-demo' | 'none';

export function normalizePathname(pathname: string): string {
  const path = pathname.trim() || '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

export function getRouteFamily(pathname: string): RouteFamily {
  const path = normalizePathname(pathname);

  if (path === '/demo' || path.startsWith('/demo/')) return 'demo';

  if (
    path === '/admin' ||
    path === '/admin-demo' ||
    path.startsWith('/admin/') ||
    path === '/book' ||
    path.startsWith('/book/') ||
    path === '/preview' ||
    path.startsWith('/preview/') ||
    path === '/setup' ||
    path.startsWith('/setup/') ||
    path === '/shop/success' ||
    path === '/shop/cancelled' ||
    /\/shop\/[^/]+\/(success|cancelled)$/.test(path)
  ) {
    return 'minimal';
  }

  if (
    path === '/' ||
    path === '/shop' ||
    path.startsWith('/shop/demo/') ||
    path === '/privacy' ||
    path === '/cookies' ||
    path === '/terms' ||
    /^\/shop\/[^/]+$/.test(path)
  ) {
    return 'marketing';
  }

  return 'other';
}

export function isSameRouteFamily(fromPathname: string, toPathname: string): boolean {
  const from = getRouteFamily(fromPathname);
  const to = getRouteFamily(toPathname);
  return from !== 'other' && from === to;
}

export function familyFromVariant(variant: RouteTransitionVariant): RouteFamily | null {
  if (variant === 'marketing') return 'marketing';
  if (variant === 'flow') return 'minimal';
  if (variant === 'themed-demo') return 'demo';
  return null;
}
