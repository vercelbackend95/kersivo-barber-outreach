import { FREE_PREVIEW_PAGE_PATH } from '@/lib/freePreview/config';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';

/**
 * Site-wide Full KERSIVO CTA pattern while FREE_PREVIEW_FLOW_ENABLED is on (docs/free-preview-spec.md §10.2).
 * Client-safe: no env reads here. Callers decide the flag on the server and pass it down.
 */
export const FREE_PREVIEW_CTA_LABEL = 'Get my free preview';
export const FREE_PREVIEW_CTA_HREF = FREE_PREVIEW_PAGE_PATH;
export const FREE_PREVIEW_CTA_TRACK = 'preview_cta_click';

/** The direct paid route stays available as a secondary text link. */
export const SUBSCRIBE_NOW_CTA_LABEL = `Or subscribe now — £${SAAS_MONTHLY_GBP}/month`;
export const SUBSCRIBE_NOW_CTA_HREF = '/admin/launch';
export const SUBSCRIBE_NOW_CTA_TRACK = 'saas_subscribe_click';

/** Desktop navbar and the mobile sheet. The compact bar uses the shorter label. */
export const NAVBAR_FREE_PREVIEW_CTA_LABEL = 'Get my free preview';

/** Fits beside the menu control below the desktop breakpoint. */
export const NAVBAR_FREE_PREVIEW_COMPACT_LABEL = 'Free preview';
