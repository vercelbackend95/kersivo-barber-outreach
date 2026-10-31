/// <reference types="astro/client" />

type NavbarPreviewCtaLocals = {
  label: string;
  href: string | null;
  track?: 'plan_my_setup_click' | 'saas_subscribe_click' | 'preview_cta_click';
};

declare namespace App {
  interface Locals {
    /** Set by middleware from navbarPreviewCta.server — never import that module in client graphs. */
    navbarPreviewCta?: NavbarPreviewCtaLocals | null;
    /** Set by /admin before it rewrites to /admin/hub (ADMIN_HUB_ENABLED only). */
    adminHubMode?: Extract<import('./lib/adminHub/adminMode').AdminPageMode, { kind: 'hub' }>;
  }
}
