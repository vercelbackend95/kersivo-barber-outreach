export const prerender = false;

import { tokenSourceOf } from '@/lib/freePreview/hubApi';
import { createHubAssetByIdHandlers } from '@/lib/previewHub/handlers/assetById';

export const { GET, PATCH, DELETE } = createHubAssetByIdHandlers(tokenSourceOf);
