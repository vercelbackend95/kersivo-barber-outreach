/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type NavbarPreviewCtaLocals = {
  label: string;
  href: string | null;
  track?: 'plan_my_setup_click';
};

declare namespace App {
  interface Locals {
    /** Set by middleware from navbarPreviewCta.server — never import that module in client graphs. */
    navbarPreviewCta?: NavbarPreviewCtaLocals | null;
  }
}
