import AdminSectionHeader from '@/components/admin/AdminSectionHeader';
import { HubMessages } from '@/components/previewHub/HubMessages';
import { ADMIN_HUB_MESSAGES_EMPTY, ADMIN_HUB_MESSAGES_SUB } from '@/lib/adminHub/copy';
import { HUB_NAV } from '@/lib/freePreview/hubCopy';
import type { HubMessagePublic } from '@/lib/freePreview/hubMessages.shared';

export function AdminHubMessages(props: {
  token: string;
  apiBase?: string;
  viewer: 'owner' | 'ops';
  requestId?: string;
  shopName: string;
  initialMessages: HubMessagePublic[];
  initialDraft?: string;
  canAttach?: boolean;
}) {
  return (
    <article className="admin-hub-messages" data-testid="admin-hub-messages">
      <AdminSectionHeader title={HUB_NAV.messages} description={ADMIN_HUB_MESSAGES_SUB} />
      <HubMessages
        token={props.token}
        apiBase={props.apiBase}
        viewer={props.viewer}
        requestId={props.requestId}
        shopName={props.shopName}
        initialMessages={props.initialMessages}
        initialDraft={props.initialDraft}
        canAttach={props.canAttach}
        chrome="section"
        emptyLabel={ADMIN_HUB_MESSAGES_EMPTY}
      />
    </article>
  );
}
