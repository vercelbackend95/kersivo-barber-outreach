export const prerender = false;

import type { APIRoute } from 'astro';
import { handlePreviewSiteData } from '@/lib/siteData/api';

/** Site data for a private preview build. Token in the X-Kersivo-Preview-Token header. */
export const GET: APIRoute = ({ request }) => handlePreviewSiteData(request);
