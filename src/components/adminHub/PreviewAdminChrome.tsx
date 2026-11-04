import type { ReactNode } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import type { AdminProfileUser } from '@/components/admin/AdminSidebarProfile';
import type { PreviewHubSection } from '@/lib/adminHub/previewHubPaths';
import type { SetupCardModel } from '@/lib/adminHub/setupCard';
import { useHubSelector } from '@/lib/adminHub/hubStore';
import '@/styles/components/admin-hub.css';
import '@/styles/components/preview-hub.css';
import '@/styles/components/opening-hours-editor.css';

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
  // Subscribes to the logo src string only: the whole admin layout re-renders only when the logo really changes
  // (a re-render on store boot shifted the mobile header — CLS).
  const shopLogoUrl = useHubSelector((state) => state.currentLogo?.src ?? null, props.shopLogoUrl);
  return (
    <AdminLayout
      mode="preview"
      previewSection={props.section}
      previewSetup={props.setup}
      previewOperator={props.isOperator}
      previewUnderConstruction={props.underConstruction}
      previewUnreadMessages={props.unreadMessages ?? 0}
      shopName={props.shopName}
      shopLogoUrl={shopLogoUrl}
      profileUser={props.profileUser}
      isTransitioning={false}
      showSectionSkeleton={false}
    >
      <div className="admin-hub-content">{props.children}</div>
    </AdminLayout>
  );
}
