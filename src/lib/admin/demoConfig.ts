/** Public admin preview route — instant access, read-only demo data. */
export const PUBLIC_ADMIN_DEMO_PATH = '/admin-demo' as const;

/** Must match server `ADMIN_SECRET` on demo deployments. */
export const DEMO_ADMIN_SECRET = 'supersecret123';

export const DEMO_ACTION_BLOCKED_MESSAGE =
  'This action is disabled in the public demo.';

export const DEMO_BANNER_LABEL = 'Admin Demo';

export const DEMO_BANNER_LEAD =
  'This is a safe preview of the KERSIVO admin dashboard using example barbershop data.';

export const DEMO_ADMIN_MODE_HEADER = 'x-admin-demo-mode';

export function adminDemoHref(section?: string): string {
  if (!section) return PUBLIC_ADMIN_DEMO_PATH;
  return `${PUBLIC_ADMIN_DEMO_PATH}?section=${section}`;
}

export function isPublicAdminDemoPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return (
    normalized === PUBLIC_ADMIN_DEMO_PATH ||
    normalized.startsWith(`${PUBLIC_ADMIN_DEMO_PATH}/`)
  );
}
