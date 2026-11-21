/**
 * Heritage Grooming replaced the CUTSTATE demo shop. Its old pages (/demo, /demo/services, /demo/admin …)
 * may still be linked from emails, bookmarks and search results, so each one sends the visitor to the
 * matching Heritage Grooming page instead of a 404. The middleware calls this for GET and HEAD requests.
 */
import {
  HERITAGE_ADMIN_DEMO_PATH,
  HERITAGE_DEMO_BASE_PATH,
  HERITAGE_DEMO_BOOK_HREF,
  HERITAGE_DEMO_CONTACT_HREF,
  HERITAGE_DEMO_GALLERY_HREF,
  HERITAGE_DEMO_SERVICES_HREF,
  HERITAGE_DEMO_SHOP_HREF,
  HERITAGE_DEMO_SITE_HREF,
  HERITAGE_DEMO_TEAM_HREF,
} from './links';

const PAGE_TARGETS: Readonly<Record<string, string>> = {
  '/demo': HERITAGE_DEMO_SITE_HREF,
  '/demo/services': HERITAGE_DEMO_SERVICES_HREF,
  '/demo/barbers': HERITAGE_DEMO_TEAM_HREF,
  '/demo/gallery': HERITAGE_DEMO_GALLERY_HREF,
  '/demo/contact': HERITAGE_DEMO_CONTACT_HREF,
  '/demo/book': HERITAGE_DEMO_BOOK_HREF,
};

/** Where a retired CUTSTATE demo page now lives, or null when the path is not one of them. */
export function retiredDemoRedirectTarget(pathname: string, search = ''): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === HERITAGE_DEMO_BASE_PATH || path.startsWith(`${HERITAGE_DEMO_BASE_PATH}/`)) return null;

  const direct = PAGE_TARGETS[path];
  if (direct) return direct;
  if (path === '/demo/shop' || path.startsWith('/demo/shop/')) return HERITAGE_DEMO_SHOP_HREF;
  if (path === '/demo/admin') {
    // Keep ?section= (and the hero showcase's ?embed=hero) so deep links land on the same view.
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const kept = new URLSearchParams();
    for (const key of ['section', 'embed']) {
      const value = params.get(key);
      if (value) kept.set(key, value);
    }
    const query = kept.toString();
    return query ? `${HERITAGE_ADMIN_DEMO_PATH}?${query}` : HERITAGE_ADMIN_DEMO_PATH;
  }
  return null;
}
