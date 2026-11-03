import { useEffect, useRef } from 'react';
import { ImagePlus } from '@/components/lucide-react';
import { ADMIN_HUB_CONTENT_EMPTY, ADMIN_HUB_TILE_CONTENT } from '@/lib/adminHub/copy';
import { hubCanAddShopItems } from '@/lib/adminHub/addMenu';
import type { AdminHubLiveState } from '@/lib/adminHub/liveState';
import { useHubState } from '@/lib/adminHub/hubStore';
import { overviewWebsiteContent } from '@/lib/adminHub/overviewTiles';
import type { HubCapabilities, HubStage } from '@/lib/freePreview/hubStage';
import { AdminHubAddMenu } from './AdminHubAddMenu';

/** Overview "Website content" tile: reads the hub store, SSR-rendered from the seeded state. */
export function AdminHubContentTile(props: {
  initialState: AdminHubLiveState;
  stage: HubStage;
  capabilities: HubCapabilities;
}) {
  const live = useHubState(props.initialState) ?? props.initialState;
  const content = overviewWebsiteContent({
    assets: live.assets,
    aboutText: live.details.aboutText,
    websiteExtraText: live.details.websiteExtraText,
  });
  // Thumbs that appear after first paint fade in (CSS skips it under prefers-reduced-motion).
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(content.thumbs.map((thumb) => thumb.id));
  const known = seen.current;
  useEffect(() => {
    for (const thumb of content.thumbs) known.add(thumb.id);
  });

  return (
    <section
      className="admin-hub-tile admin-hub-bento__content"
      data-tile="content"
      data-testid="admin-hub-content-tile"
      aria-labelledby="admin-hub-content-title"
    >
      <div className="admin-hub-tile__head">
        <span className="admin-hub-tile__icon" aria-hidden="true">
          <ImagePlus width={15} height={15} strokeWidth={1.8} />
        </span>
        <h2 className="admin-hub-tile__title" id="admin-hub-content-title">
          {ADMIN_HUB_TILE_CONTENT}
        </h2>
        <AdminHubAddMenu
          variant="icon"
          stage={props.stage}
          capabilities={props.capabilities}
          canAddShop={hubCanAddShopItems(props.stage)}
          tone="outline"
        />
      </div>
      {content.empty ? (
        <div className="admin-hub-content-empty">
          <p>{ADMIN_HUB_CONTENT_EMPTY}</p>
        </div>
      ) : (
        <div className="admin-hub-content-body">
          {content.thumbs.length ? (
            <ul className="admin-hub-thumbs">
              {content.thumbs.map((thumb) => (
                <li key={thumb.id} className={known.has(thumb.id) ? undefined : 'admin-hub-thumb--new'}>
                  <img src={thumb.src} alt="" width="72" height="72" loading="lazy" />
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="admin-hub-status">
            {content.status.map((row) => (
              <li key={row.id}>
                <a href={row.href} data-content-item={row.id}>
                  <span>{row.label}</span>
                  <span className={`admin-hub-status__value${row.done ? ' admin-hub-status__value--done' : ''}`}>
                    {row.value}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
