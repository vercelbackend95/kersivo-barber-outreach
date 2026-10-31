import { PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY, PREVIEW_EXPIRY_DAYS } from './config';

/** Draft legal text (spec §12), for the owner's review. Rendered on /terms; changing it needs a Terms version bump. */
export const FREE_PREVIEW_TERMS_TEXT = `At your request, we may design a free, private preview of a website and booking page for your barbershop. The preview is free of charge and without obligation. It is for your review only, is not published or indexed by search engines, and remains available for ${PREVIEW_EXPIRY_DAYS} days. Bookings made on a preview are for testing only: no appointments are created and no payments are taken. By requesting a preview, you confirm that you are authorised to act for the barbershop and that we may use the details, text and images from the links and files you send us solely to create your preview. If you do not subscribe, we delete the preview and the information you provided for it within ${PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY} days of the preview expiring.`;

/** /privacy, "How long we keep data". */
export const FREE_PREVIEW_PRIVACY_RETENTION_TEXT = `If you do not subscribe, we delete your preview and the information you provided for it within ${PREVIEW_DATA_RETENTION_DAYS_AFTER_EXPIRY} days of the preview expiring (or of us declining the request, if no preview was sent). We keep only an anonymised record of the request's status and dates, which cannot be linked back to you or your shop, to count how the service is used. Terms acceptance evidence from a checkout you started may be kept as described below. If you subscribe, the preview becomes your live site and its details become part of your account records.`;

/** /privacy, under the free website preview collection section. Unconditional — legal pages describe what can happen. */
export const FREE_PREVIEW_PRIVACY_HUB_FILES_TEXT =
  "Files you add in your private shop hub (logo, photos, price lists) are used only to build your preview and website, and are deleted with your preview if you don't launch.";
