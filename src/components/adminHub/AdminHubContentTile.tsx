import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Paperclip } from '@/components/lucide-react';
import {
  ADMIN_HUB_CONTENT_EMPTY,
  ADMIN_HUB_CONTENT_LOGO,
  ADMIN_HUB_CONTENT_MORE_PHOTOS,
  ADMIN_HUB_CONTENT_PHOTO,
  ADMIN_HUB_CONTENT_SHOW_ALL_PHOTOS,
  ADMIN_HUB_TILE_CONTENT,
} from '@/lib/adminHub/copy';
import { adminHubMaterialsHref, hubCanAddShopItems } from '@/lib/adminHub/addMenu';
import { currentHubLogoOptionsFromDetails } from '@/lib/adminHub/currentLogo';
import type { AdminHubLiveState } from '@/lib/adminHub/liveState';
import { useHubState } from '@/lib/adminHub/hubStore';
import {
  logoNeedsLightPlate,
  overviewPhotoGrid,
  overviewWebsiteContent,
  type OverviewContentImage,
  type OverviewContentLogo,
  type OverviewPhotoCell,
} from '@/lib/adminHub/overviewTiles';
import type { HubCapabilities, HubStage } from '@/lib/freePreview/hubStage';
import { AdminHubAddMenu } from './AdminHubAddMenu';

/** The large cell (1 photo, or the lead of 3) renders wider than the 480 px thumb: let the browser pick. */
const LEAD_PHOTO_SIZES = '(min-width: 1280px) 640px, (min-width: 768px) 420px, 100vw';

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
    logoOptions: currentHubLogoOptionsFromDetails(live.details),
  });
  const grid = overviewPhotoGrid(content.photos.length, content.photoTotal);
  // Photos that appear after first paint fade in (CSS skips it under prefers-reduced-motion).
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(content.photos.map((photo) => photo.id));
  const known = seen.current;
  useEffect(() => {
    for (const photo of content.photos) known.add(photo.id);
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
          <div
            className={[
              'admin-hub-content-layout',
              content.logo ? '' : 'admin-hub-content-layout--no-logo',
              content.photos.length ? '' : 'admin-hub-content-layout--no-photos',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {content.logo || content.photos.length ? (
              <div className="admin-hub-content-media">
                {content.logo ? <ContentLogo logo={content.logo} /> : null}
                {content.photos.length ? (
                  <div className="admin-hub-content-photos">
                    <ul
                      className={`admin-hub-photos admin-hub-photos--${grid.layout}`}
                      data-testid="admin-hub-content-photos"
                      data-count={content.photos.length}
                    >
                      {content.photos.map((photo, index) => (
                        <ContentPhoto
                          key={photo.id}
                          photo={photo}
                          cell={grid.cells[index]!}
                          index={index}
                          total={content.photoTotal}
                          lead={index === 0 && (grid.layout === 'one' || grid.layout === 'three')}
                          fresh={!known.has(photo.id)}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
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
        </div>
      )}
    </section>
  );
}

function ContentPhoto(props: {
  photo: OverviewContentImage;
  cell: OverviewPhotoCell;
  index: number;
  total: number;
  lead: boolean;
  fresh: boolean;
}) {
  const { photo, cell } = props;
  const wide = props.lead && photo.fullSrc;
  const className = [
    'admin-hub-photo',
    cell.from !== 'narrow' ? `admin-hub-photo--from-${cell.from}` : '',
    props.fresh ? 'admin-hub-thumb--new' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <li className={className} data-more={cell.more ? cell.more.at.join(' ') : undefined}>
      <a href={adminHubMaterialsHref('photos')} className="admin-hub-photo__link">
        <img
          src={photo.src}
          srcSet={wide ? `${photo.src} ${photo.width}w, ${photo.fullSrc} ${photo.fullWidth}w` : undefined}
          sizes={wide ? LEAD_PHOTO_SIZES : undefined}
          alt=""
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
        />
        <span className="admin-hub-photo__name">{ADMIN_HUB_CONTENT_PHOTO(props.index + 1, props.total)}</span>
        {cell.more ? (
          <span className="admin-hub-photo__more">
            <span aria-hidden="true">{ADMIN_HUB_CONTENT_MORE_PHOTOS(cell.more.n)}</span>
            <span className="admin-hub-photo__more-name">{ADMIN_HUB_CONTENT_SHOW_ALL_PHOTOS(props.total)}</span>
          </span>
        ) : null}
      </a>
    </li>
  );
}

/** Dark logos (black on transparent) would vanish on the neutral surface: measured once per src. */
const lightPlateBySrc = new Map<string, boolean>();

function measureLogoPlate(img: HTMLImageElement): boolean {
  try {
    const scale = Math.min(1, 48 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, width, height);
    return logoNeedsLightPlate(ctx.getImageData(0, 0, width, height));
  } catch {
    return false;
  }
}

function ContentLogo(props: { logo: OverviewContentLogo }) {
  const src = props.logo.src;
  const [lightPlate, setLightPlate] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) {
      setLightPlate(false);
      return;
    }
    const cached = lightPlateBySrc.get(src);
    if (cached !== undefined) {
      setLightPlate(cached);
      return;
    }
    const check = () => {
      if (!img.naturalWidth) return;
      const result = measureLogoPlate(img);
      lightPlateBySrc.set(src, result);
      setLightPlate(result);
    };
    if (img.complete) check();
    else img.addEventListener('load', check, { once: true });
    return () => img.removeEventListener('load', check);
  }, [src]);

  return (
    <a
      href={adminHubMaterialsHref('logo')}
      className={`admin-hub-content-logo${lightPlate ? ' admin-hub-content-logo--light' : ''}`}
      data-testid="admin-hub-content-logo"
    >
      <span className="admin-hub-content-logo__box">
        {src ? (
          <img
            key={src}
            ref={imgRef}
            src={src}
            alt=""
            width={props.logo.width}
            height={props.logo.height}
            decoding="async"
          />
        ) : (
          <Paperclip width={22} height={22} strokeWidth={1.6} aria-hidden="true" />
        )}
      </span>
      <span className="admin-hub-content-logo__caption">{ADMIN_HUB_CONTENT_LOGO}</span>
    </a>
  );
}
