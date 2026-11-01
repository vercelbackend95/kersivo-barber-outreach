export const prerender = false;

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { createHubAssetByIdHandlers } from '@/lib/previewHub/handlers/assetById';

export const { GET, PATCH, DELETE } = createHubAssetByIdHandlers(cookieSourceOf);
