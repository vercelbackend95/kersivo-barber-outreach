import { HubMessages } from '@/components/previewHub/HubMessages';
import type { AdminHubAppBodyProps } from './types';

export default function MessagesApp({ ctx }: AdminHubAppBodyProps) {
  return (
    <HubMessages
      token=""
      apiBase={ctx.apiBase}
      viewer={ctx.viewer}
      requestId={ctx.requestId}
      shopName={ctx.shopName}
      initialMessages={ctx.messages}
      initialDraft={ctx.initialDraft}
      canAttach={ctx.canAttach}
    />
  );
}
