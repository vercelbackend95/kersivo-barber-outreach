import { useCallback, useEffect, useState } from 'react';
import { WebsiteSetupFlow, type SetupView } from '@/components/adminHub/setup/WebsiteSetupFlow';
import { ADMIN_HUB_LOCATION_EVENT, parseAdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import type { AdminHubAppBodyProps } from './types';

function viewFromLocation(): SetupView {
  if (typeof window === 'undefined') return 'all';
  return parseAdminHubAddWebsiteItem(new URLSearchParams(window.location.search).get('item')) ?? 'all';
}

/**
 * Overview › Add to your website. Opened from an Add menu item (`?item=business`) it shows that one section;
 * without `?item=` (or after "All") every section in one column. The switcher rewrites `?item=` in place, so
 * Back still closes the window and a reload reopens the same section.
 */
export default function MaterialsApp({ ctx }: AdminHubAppBodyProps) {
  const [view, setView] = useState<SetupView>(viewFromLocation);

  useEffect(() => {
    const sync = () => setView(viewFromLocation());
    window.addEventListener('popstate', sync);
    window.addEventListener(ADMIN_HUB_LOCATION_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ADMIN_HUB_LOCATION_EVENT, sync);
    };
  }, []);

  const changeView = useCallback((next: SetupView) => {
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.delete('item');
    else url.searchParams.set('item', next);
    const state = { ...(history.state ?? {}), adminHubApp: 'materials', adminHubItem: next === 'all' ? null : next };
    history.replaceState(state, '', url);
    window.dispatchEvent(new Event(ADMIN_HUB_LOCATION_EVENT));
  }, []);

  return <WebsiteSetupFlow ctx={ctx} view={view} onViewChange={changeView} />;
}
