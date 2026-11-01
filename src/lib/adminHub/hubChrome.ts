import type { AdminProfileUser } from '@/components/admin/AdminSidebarProfile';
import type { SetupCardModel } from '@/lib/adminHub/setupCard';
import type { PreviewHubSection } from '@/lib/adminHub/previewHubPaths';

/** Preview-hub chrome passed into the real AdminPanel. Client-safe. */
export type AdminHubChrome = {
  section: PreviewHubSection;
  setup: SetupCardModel | null;
  unreadMessages: number;
  isOperator: boolean;
  shopName: string;
  shopLogoUrl: string | null;
  profileUser: AdminProfileUser;
  underConstruction: boolean;
};
