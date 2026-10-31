import { HubYourShop } from '@/components/previewHub/HubYourShop';
import type { AdminHubAppBodyProps } from './types';

export default function AboutApp({ ctx }: AdminHubAppBodyProps) {
  return (
    <HubYourShop
      token=""
      apiBase={ctx.apiBase}
      canUpload={ctx.canUpload}
      canEditDetails={ctx.canEditDetails}
      details={ctx.details}
      assets={ctx.assets}
      focus="about"
      chrome={false}
    />
  );
}
