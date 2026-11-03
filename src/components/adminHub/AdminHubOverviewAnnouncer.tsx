import { useEffect, useRef, useState } from 'react';
import { ADMIN_HUB_OVERVIEW_UPDATED } from '@/lib/adminHub/copy';
import { useHubSnapshot } from '@/lib/adminHub/hubStore';

/** Visually hidden polite live region: "Overview updated" once per refresh that changed something. */
export function AdminHubOverviewAnnouncer() {
  const { revision } = useHubSnapshot();
  const first = useRef(revision);
  const [text, setText] = useState('');

  useEffect(() => {
    if (revision === first.current) return;
    // Clear first so the same words are announced again on the next change.
    setText('');
    const id = window.setTimeout(() => setText(ADMIN_HUB_OVERVIEW_UPDATED), 50);
    return () => window.clearTimeout(id);
  }, [revision]);

  return (
    <p className="admin-hub-sr-only" aria-live="polite" data-testid="admin-hub-overview-live">
      {text}
    </p>
  );
}
