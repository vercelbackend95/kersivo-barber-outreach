import type { HubUploadedAsset } from '@/components/previewHub/HubUploader';
import type { HubReviewMap } from '@/components/previewHub/HubReviewCards';
import type { HubShopDetails } from '@/components/previewHub/HubYourShop';
import type { HubReviewShopData } from '@/lib/freePreview/hubReviews.shared';
import type { HubMessagePublic } from '@/lib/freePreview/hubMessages.shared';
import type { HubStage } from '@/lib/freePreview/hubStage';
import type { SetupItem } from '@/lib/adminHub/setupCard';

export type AdminHubActivityRow = {
  id: string;
  label: string;
  relative: string;
  absolute: string;
  at: string;
};

export type AdminHubLaunchFlags = {
  businessDone: boolean;
  domainDone: boolean;
  paymentsDone: boolean;
  approveDone: boolean;
};

export type AdminHubAppContext = {
  apiBase: string;
  canUpload: boolean;
  canEditDetails: boolean;
  canReview: boolean;
  canEditLaunch: boolean;
  stage: HubStage;
  details: HubShopDetails;
  assets: HubUploadedAsset[];
  reviews: HubReviewMap;
  reviewShop: HubReviewShopData | null;
  activity: AdminHubActivityRow[];
  setupItems: SetupItem[];
  messages: HubMessagePublic[];
  initialDraft: string;
  viewer: 'owner' | 'ops';
  requestId?: string;
  canAttach: boolean;
  shopName: string;
  websiteHref: string;
  bookingHref: string;
  launch: AdminHubLaunchFlags | null;
};

export type AdminHubAppBodyProps = {
  ctx: AdminHubAppContext;
};
