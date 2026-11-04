export const prerender = false;

import type { APIRoute } from 'astro';
import { handlePublicSiteData } from '@/lib/siteData/api';

/** Site data contract for a published shop website. docs/site-data-contract.md */
export const GET: APIRoute = ({ params, url }) => handlePublicSiteData(params.identifier, url);
