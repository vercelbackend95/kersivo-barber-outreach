import { useEffect, useState } from 'react';
import { HubYourShop } from '@/components/previewHub/HubYourShop';
import { ADMIN_HUB_LOCATION_EVENT, parseAdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import type { AdminHubAppBodyProps } from './types';

function itemFromLocation() {
  if (typeof window === 'undefined') return null;
  return parseAdminHubAddWebsiteItem(new URLSearchParams(window.location.search).get('item'));
}

export default function MaterialsApp({ ctx }: AdminHubAppBodyProps) {
  const [highlight, setHighlight] = useState(itemFromLocation);

  useEffect(() => {
    const sync = () => setHighlight(itemFromLocation());
    window.addEventListener('popstate', sync);
    window.addEventListener(ADMIN_HUB_LOCATION_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ADMIN_HUB_LOCATION_EVENT, sync);
    };
  }, []);

  return (
    <HubYourShop
      token=""
      apiBase={ctx.apiBase}
      canUpload={ctx.canUpload}
      canEditDetails={ctx.canEditDetails}
      details={ctx.details}
      assets={ctx.assets}
      focus="materials"
      highlight={highlight}
      chrome={false}
    />
  );
}
