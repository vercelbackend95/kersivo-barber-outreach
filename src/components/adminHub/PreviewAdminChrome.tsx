import type { ReactNode } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import type { AdminProfileUser } from '@/components/admin/AdminSidebarProfile';
import type { PreviewHubSection } from '@/lib/adminHub/previewHubPaths';
import type { SetupCardModel } from '@/lib/adminHub/setupCard';
import '@/styles/components/admin-hub.css';
import '@/styles/components/preview-hub.css';

export function PreviewAdminChrome(props: {
  section: PreviewHubSection;
  shopName: string;
  shopLogoUrl: string | null;
  profileUser: AdminProfileUser;
  setup: SetupCardModel | null;
  underConstruction: boolean;
  isOperator: boolean;
  unreadMessages?: number;
  children: ReactNode;
}) {
  return (
    <AdminLayout
      mode="preview"
      previewSection={props.section}
      previewSetup={props.setup}
      previewOperator={props.isOperator}
      previewUnderConstruction={props.underConstruction}
      previewUnreadMessages={props.unreadMessages ?? 0}
      shopName={props.shopName}
      shopLogoUrl={props.shopLogoUrl}
      profileUser={props.profileUser}
      isTransitioning={false}
      showSectionSkeleton={false}
    >
      <div className="admin-hub-content">{props.children}</div>
    </AdminLayout>
  );
}
