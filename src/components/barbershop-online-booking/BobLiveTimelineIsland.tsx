import { useEffect, useState, type ComponentType } from 'react';

import type { BobLiveTimelineProps } from './BobLiveTimeline';

/**
 * Island shell for the real KERSIVO owner timeline on /barbershop-online-booking.
 *
 * Server HTML and the first client render are an empty sized box (sized by the page CSS). The
 * timeline, its demo data and its stylesheets load after this island hydrates, so demo names stay
 * out of the document. Same pattern as `DeferredWidget`: everything here runs in the browser, so
 * import only client-safe modules (guarded by src/lib/seo/deferredWidgetClientSafe.test.ts).
 * Stylesheets are static imports inside BobLiveTimeline: never `import()` a .css file here.
 */
export default function BobLiveTimelineIsland(props: BobLiveTimelineProps) {
  const [Timeline, setTimeline] = useState<ComponentType<BobLiveTimelineProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('./BobLiveTimeline').then((mod) => {
      if (!cancelled) setTimeline(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`bobtl-slot${Timeline ? ' is-mounted' : ''}`} data-nosnippet>
      {Timeline ? <Timeline {...props} /> : <div className="bobtl-slot__skeleton" aria-hidden="true" />}
    </div>
  );
}
