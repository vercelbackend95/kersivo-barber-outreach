import { useEffect, useState } from 'react';
import { WebsiteSetupFlow } from '@/components/adminHub/setup/WebsiteSetupFlow';
import { ADMIN_HUB_LOCATION_EVENT, parseAdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import type { AdminHubAppBodyProps } from './types';

function itemFromLocation() {
  if (typeof window === 'undefined') return null;
  return parseAdminHubAddWebsiteItem(new URLSearchParams(window.location.search).get('item'));
}

/** Overview › Add to your website: the guided, single-column setup flow. */
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

  return <WebsiteSetupFlow ctx={ctx} highlight={highlight} />;
}
