/**
 * Where the Heritage Grooming live demo lives. Marketing links point here instead of the CUTSTATE demo,
 * which stays online at /demo.
 *
 * The site is static (public/demo/heritage-grooming) and uses relative asset paths, so links name the
 * HTML file: with trailingSlash off, /demo/heritage-grooming would resolve its css/ and js/ one level up.
 * Kept free of imports so the marketing nav can use it without pulling in the demo catalogue.
 */
export const HERITAGE_DEMO_BASE_PATH = '/demo/heritage-grooming' as const;
export const HERITAGE_DEMO_SITE_HREF = `${HERITAGE_DEMO_BASE_PATH}/index.html` as const;
export const HERITAGE_DEMO_BOOK_HREF = `${HERITAGE_DEMO_BASE_PATH}/services.html#book` as const;
export const HERITAGE_DEMO_SHOP_HREF = `${HERITAGE_DEMO_BASE_PATH}/shop.html` as const;
export const HERITAGE_DEMO_SERVICES_HREF = `${HERITAGE_DEMO_BASE_PATH}/services.html` as const;
export const HERITAGE_DEMO_TEAM_HREF = `${HERITAGE_DEMO_BASE_PATH}/team.html` as const;
export const HERITAGE_ADMIN_DEMO_PATH = `${HERITAGE_DEMO_BASE_PATH}/admin` as const;
export const HERITAGE_ADMIN_DASHBOARD_HREF = `${HERITAGE_ADMIN_DEMO_PATH}?section=bookings_dashboard` as const;

/** Where every generic "live demo" link on the marketing site goes. */
export const KERSIVO_LIVE_DEMO_HREF = HERITAGE_DEMO_SITE_HREF;
