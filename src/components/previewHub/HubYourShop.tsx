import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PreviewHubAssetKind } from '@prisma/client';
import { extractLogoHexes, HEX_COLOUR_RE } from '@/lib/freePreview/extractLogoColours';
import {
  HUB_CAPTION_LABEL,
  HUB_CAPTION_PLACEHOLDER,
  HUB_DELETE,
  HUB_DETAILS_ABOUT_HINT,
  HUB_DETAILS_ABOUT_TITLE,
  HUB_DETAILS_BRAND_TITLE,
  HUB_DETAILS_COLOUR_PRIMARY,
  HUB_DETAILS_COLOUR_SECONDARY,
  HUB_DETAILS_HEX_LABEL,
  HUB_DETAILS_HOURS_TITLE,
  HUB_DETAILS_PHOTOS_TITLE,
  HUB_DETAILS_PICK_FROM_LOGO,
  HUB_DETAILS_PLACEHOLDER_LINKS,
  HUB_DETAILS_PRICE_HEAD,
  HUB_DETAILS_PRICE_TITLE,
  HUB_DETAILS_SERVICES_TITLE,
  HUB_DETAILS_STYLE_HINT,
  HUB_DETAILS_STYLE_LABEL,
  HUB_DETAILS_SWATCH_DARK,
  HUB_DETAILS_SWATCH_LIGHT,
  HUB_DETAILS_TEAM_PHOTOS_TITLE,
  HUB_DETAILS_TEAM_TITLE,
  HUB_DETAILS_TITLE,
  HUB_EMPTY_LOGO,
  HUB_EMPTY_PHOTOS,
  HUB_EMPTY_PRICE,
  HUB_EMPTY_TEAM_PHOTOS,
  HUB_FILES_PRIVACY,
  HUB_MOVE_DOWN,
  HUB_MOVE_UP,
  HUB_RETRY,
  HUB_SAVE_FAILED,
  HUB_SAVED,
  HUB_SAVING,
  HUB_UNDO,
  HUB_UPLOAD_HINT_PHOTOS,
  HUB_UPLOAD_HINT_PRICE,
} from '@/lib/freePreview/hubCopy';
import { hubApiRoot } from '@/lib/adminHub/links';
import { HubUploader, type HubUploadedAsset } from './HubUploader';
import { HubReviewCards, type HubReviewMap } from './HubReviewCards';
import type { HubReviewShopData } from '@/lib/freePreview/hubReviews.shared';

export type HubShopDetails = {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  styleNotes: string | null;
  aboutText: string | null;
  brandBackgroundTone?: 'DARK' | 'LIGHT' | null;
  brandColoursSource?: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted?: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt?: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const UNDO_MS = 5000;
const AUTOSAVE_MS = 700;

function assetUrl(apiRoot: string, id: string, size: 'thumb' | 'full') {
  return `${apiRoot}/assets/${encodeURIComponent(id)}?size=${size}`;
}

function displayUrl(apiRoot: string, asset: HubUploadedAsset) {
  if (asset.hasThumb) return assetUrl(apiRoot, asset.id, 'thumb');
  if (asset.contentType.startsWith('image/') && !asset.contentType.includes('svg')) {
    return assetUrl(apiRoot, asset.id, 'full');
  }
  return null;
}

async function patchAsset(apiRoot: string, id: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiRoot}/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || HUB_SAVE_FAILED);
}

async function deleteAsset(apiRoot: string, id: string) {
  const response = await fetch(`${apiRoot}/assets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || HUB_SAVE_FAILED);
}

function SaveHint({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const text = state === 'saving' ? HUB_SAVING : state === 'saved' ? HUB_SAVED : HUB_SAVE_FAILED;
  return (
    <p className={`hub-savehint is-${state}`} role="status">
      {text}
    </p>
  );
}

function HexField(props: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={props.id}>
        {props.label}
      </label>
      <div className="hub-hex">
        <span className="hub-hex__swatch" style={{ background: HEX_COLOUR_RE.test(props.value) ? props.value : '#333' }} />
        <input
          id={props.id}
          className="input"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          disabled={props.disabled}
          value={props.value}
          aria-label={`${props.label} ${HUB_DETAILS_HEX_LABEL}`}
          onChange={(event) => props.onChange(event.target.value.toUpperCase())}
        />
      </div>
    </div>
  );
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <section className="hub-card ks-glass-card">
      <h2 className="hub-card__title">{title}</h2>
      <p className="hub-card__body">{HUB_DETAILS_PLACEHOLDER_LINKS}</p>
    </section>
  );
}

function PhotoTile(props: {
  apiRoot: string;
  asset: HubUploadedAsset;
  canEdit: boolean;
  compact?: boolean;
  onCaption: (value: string) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}) {
  const src = displayUrl(props.apiRoot, props.asset);
  const isPdf = props.asset.contentType.includes('pdf') || props.asset.originalFileName.toLowerCase().endsWith('.pdf');
  return (
    <li
      className="hub-photo"
      draggable={props.canEdit && !props.compact}
      onDragStart={props.onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        props.onDrop?.();
      }}
    >
      <div className="hub-photo__media">
        {src ? (
          <img src={src} alt={props.asset.caption || props.asset.originalFileName} />
        ) : (
          <p className="hub-photo__file">{isPdf ? 'PDF' : props.asset.originalFileName}</p>
        )}
      </div>
      {props.canEdit ? (
        <>
          <label className="hub-sr-only" htmlFor={`cap-${props.asset.id}`}>
            {HUB_CAPTION_LABEL}
          </label>
          <input
            id={`cap-${props.asset.id}`}
            className="input"
            maxLength={140}
            placeholder={HUB_CAPTION_PLACEHOLDER}
            defaultValue={props.asset.caption ?? ''}
            onBlur={(event) => props.onCaption(event.target.value)}
          />
          <div className="hub-photo__tools">
            <button type="button" className="btn btn--ghost btn--sm hub-photo__move" onClick={() => props.onMove(-1)}>
              {HUB_MOVE_UP}
            </button>
            <button type="button" className="btn btn--ghost btn--sm hub-photo__move" onClick={() => props.onMove(1)}>
              {HUB_MOVE_DOWN}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={props.onDelete}>
              {HUB_DELETE}
            </button>
          </div>
        </>
      ) : props.asset.caption ? (
        <p className="hub-card__body">{props.asset.caption}</p>
      ) : null}
    </li>
  );
}

export function HubYourShop(props: {
  token: string;
  apiBase?: string;
  canUpload: boolean;
  canEditDetails: boolean;
  canReview?: boolean;
  reviews?: HubReviewMap;
  reviewShop?: HubReviewShopData | null;
  details: HubShopDetails;
  assets: HubUploadedAsset[];
  /** Admin Hub apps: show one block. Omitted = today's full Your shop page. */
  focus?: 'logo' | 'photos' | 'about';
  /** When false, the page H1 is omitted (the app window already has a title). */
  chrome?: boolean;
}) {
  const focus = props.focus;
  const chrome = props.chrome !== false && !focus;
  const showLogo = !focus || focus === 'logo';
  const showPhotos = !focus || focus === 'photos';
  const showAbout = !focus || focus === 'about';
  const showReviews = !focus;
  const showBrandExtras = showLogo && !focus;
  const apiRoot = hubApiRoot(props);
  const [assets, setAssets] = useState(props.assets);
  const [details, setDetails] = useState(props.details);
  const [primary, setPrimary] = useState(props.details.brandPrimaryColour ?? '');
  const [secondary, setSecondary] = useState(props.details.brandSecondaryColour ?? '');
  const [styleNotes, setStyleNotes] = useState(props.details.styleNotes ?? '');
  const [aboutText, setAboutText] = useState(props.details.aboutText ?? '');
  const [palette, setPalette] = useState<string[]>([]);
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const knownAssets = useRef<HubUploadedAsset[]>(props.assets);
  const deleteTimer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);
  const dragId = useRef<string | null>(null);

  const logos = assets.filter((asset) => asset.kind === 'LOGO');
  const photos = assets.filter((asset) => asset.kind === 'SHOP_PHOTO');
  const teamPhotos = assets.filter((asset) => asset.kind === 'TEAM_PHOTO');
  const prices = assets.filter((asset) => asset.kind === 'PRICE_LIST');
  const logo = logos[logos.length - 1] ?? null;

  const addAsset = (asset: HubUploadedAsset) => {
    knownAssets.current = [...knownAssets.current.filter((row) => row.id !== asset.id), asset];
    setAssets((current) => [...current, asset]);
    setError(null);
  };

  const persistDetails = useCallback(
    async (patch: Partial<HubShopDetails>) => {
      setSave('saving');
      try {
        const response = await fetch(`${apiRoot}/details`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const payload = (await response.json()) as { ok?: boolean; details?: HubShopDetails; error?: string };
        if (!response.ok || !payload.ok || !payload.details) throw new Error(payload.error || HUB_SAVE_FAILED);
        setDetails(payload.details);
        setSave('saved');
      } catch (err) {
        setSave('error');
        setError(err instanceof Error ? err.message : HUB_SAVE_FAILED);
      }
    },
    [apiRoot],
  );

  const queueDetails = (patch: Partial<HubShopDetails>) => {
    if (!props.canEditDetails) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistDetails(patch);
    }, AUTOSAVE_MS);
  };

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
  }, []);

  const onHex = (field: 'brandPrimaryColour' | 'brandSecondaryColour', raw: string, setter: (v: string) => void) => {
    setter(raw);
    if (raw === '' || HEX_COLOUR_RE.test(raw)) {
      queueDetails({ [field]: raw === '' ? null : raw });
    }
  };

  const pickFromLogo = async () => {
    if (!logo) return;
    try {
      const url = displayUrl(apiRoot, logo);
      if (!url) return;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(HUB_SAVE_FAILED));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || 1;
      canvas.height = image.naturalHeight || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setPalette(extractLogoHexes(pixels));
    } catch {
      setError(HUB_SAVE_FAILED);
    }
  };

  const commitDelete = async (id: string) => {
    try {
      await deleteAsset(apiRoot, id);
      setAssets((current) => current.filter((asset) => asset.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_SAVE_FAILED);
    }
  };

  const requestDelete = (asset: HubUploadedAsset) => {
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    setPendingDelete({ id: asset.id, label: asset.originalFileName });
    setAssets((current) => current.filter((item) => item.id !== asset.id));
    deleteTimer.current = window.setTimeout(() => {
      void commitDelete(asset.id);
      setPendingDelete(null);
    }, UNDO_MS);
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    const restored = knownAssets.current.find((asset) => asset.id === pendingDelete.id);
    if (restored) setAssets((current) => [...current, restored].sort((a, b) => a.sortOrder - b.sortOrder));
    setPendingDelete(null);
  };

  const moveAsset = async (kind: PreviewHubAssetKind, id: string, dir: -1 | 1) => {
    const group = assets.filter((asset) => asset.kind === kind);
    const index = group.findIndex((asset) => asset.id === id);
    const swap = group[index + dir];
    if (!swap || index < 0) return;
    const next = assets.map((asset) => {
      if (asset.id === id) return { ...asset, sortOrder: swap.sortOrder };
      if (asset.id === swap.id) return { ...asset, sortOrder: group[index]!.sortOrder };
      return asset;
    });
    setAssets(next);
    try {
      await Promise.all([
        patchAsset(apiRoot, id, { sortOrder: swap.sortOrder }),
        patchAsset(apiRoot, swap.id, { sortOrder: group[index]!.sortOrder }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_SAVE_FAILED);
    }
  };

  const dropAsset = async (kind: PreviewHubAssetKind, targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const group = assets.filter((asset) => asset.kind === kind);
    const from = group.findIndex((asset) => asset.id === sourceId);
    const to = group.findIndex((asset) => asset.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...group];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved!);
    const updates = reordered.map((asset, index) => ({ ...asset, sortOrder: index }));
    setAssets((current) => current.map((asset) => updates.find((row) => row.id === asset.id) ?? asset));
    try {
      await Promise.all(updates.map((asset) => patchAsset(apiRoot, asset.id, { sortOrder: asset.sortOrder })));
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_SAVE_FAILED);
    }
  };

  const logoSrc = logo ? displayUrl(apiRoot, logo) : null;
  const selectedPrimary = HEX_COLOUR_RE.test(primary) ? primary : details.brandPrimaryColour;

  const toast = useMemo(() => {
    if (pendingDelete) return { text: `${pendingDelete.label} removed.`, action: HUB_UNDO };
    if (save === 'saved') return { text: HUB_SAVED };
    return null;
  }, [pendingDelete, save]);

  return (
    <article className="hub-details">
      {chrome ? (
        <header className="hub-header">
          <div>
            <h1>{HUB_DETAILS_TITLE}</h1>
            <p className="hub-header__sub">{HUB_FILES_PRIVACY}</p>
          </div>
          <SaveHint state={save} />
        </header>
      ) : (
        <SaveHint state={save} />
      )}

      {error ? (
        <section className="hub-card ks-glass-card hub-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setError(null)}>
            {HUB_RETRY}
          </button>
        </section>
      ) : null}

      {showLogo ? (
      <section className="hub-card ks-glass-card" aria-labelledby="hub-brand-title">
        <h2 id="hub-brand-title" className="hub-card__title">
          {HUB_DETAILS_BRAND_TITLE}
        </h2>
        <div className="hub-swatches">
          <figure className="hub-swatch hub-swatch--dark">
            {logoSrc ? <img src={logoSrc} alt="" /> : <p>{HUB_EMPTY_LOGO}</p>}
            <figcaption>{HUB_DETAILS_SWATCH_DARK}</figcaption>
          </figure>
          <figure className="hub-swatch hub-swatch--light">
            {logoSrc ? <img src={logoSrc} alt="" /> : <p>{HUB_EMPTY_LOGO}</p>}
            <figcaption>{HUB_DETAILS_SWATCH_LIGHT}</figcaption>
          </figure>
        </div>
        {props.canUpload ? <HubUploader token={props.token} apiBase={props.apiBase} kind="LOGO" multiple={false} onUploaded={addAsset} /> : null}
        {showBrandExtras ? (
          <>
            <div className="hub-colours">
              <HexField
                id="hub-primary"
                label={HUB_DETAILS_COLOUR_PRIMARY}
                value={primary}
                disabled={!props.canEditDetails}
                onChange={(value) => onHex('brandPrimaryColour', value, setPrimary)}
              />
              <HexField
                id="hub-secondary"
                label={HUB_DETAILS_COLOUR_SECONDARY}
                value={secondary}
                disabled={!props.canEditDetails}
                onChange={(value) => onHex('brandSecondaryColour', value, setSecondary)}
              />
            </div>
            {logo && props.canEditDetails ? (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => void pickFromLogo()}>
                {HUB_DETAILS_PICK_FROM_LOGO}
              </button>
            ) : null}
            {palette.length ? (
              <div className="hub-chips" role="list">
                {palette.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`hub-chip${selectedPrimary === hex ? ' is-selected' : ''}`}
                    style={{ background: hex }}
                    aria-label={`Use ${hex} as primary`}
                    onClick={() => {
                      setPrimary(hex);
                      queueDetails({ brandPrimaryColour: hex });
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSecondary(hex);
                      queueDetails({ brandSecondaryColour: hex });
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div className="field" style={{ marginTop: 16 }}>
              <label className="field__label" htmlFor="hub-style">
                {HUB_DETAILS_STYLE_LABEL}
              </label>
              <p className="field__hint">{HUB_DETAILS_STYLE_HINT}</p>
              <textarea
                id="hub-style"
                className="textarea"
                maxLength={500}
                disabled={!props.canEditDetails}
                value={styleNotes}
                onChange={(event) => {
                  setStyleNotes(event.target.value);
                  queueDetails({ styleNotes: event.target.value });
                }}
              />
            </div>
          </>
        ) : null}
      </section>
      ) : null}

      {showPhotos ? (
      <>
      <section className="hub-card ks-glass-card" aria-labelledby="hub-photos-title">
        <h2 id="hub-photos-title" className="hub-card__title">
          {HUB_DETAILS_PHOTOS_TITLE}
        </h2>
        <p className="hub-card__body">{HUB_UPLOAD_HINT_PHOTOS}</p>
        {props.canUpload ? (
          <HubUploader token={props.token} apiBase={props.apiBase} kind="SHOP_PHOTO" hint={HUB_UPLOAD_HINT_PHOTOS} onUploaded={addAsset} />
        ) : null}
        {photos.length ? (
          <ul className="hub-photo-grid">
            {photos.map((asset) => (
              <PhotoTile
                key={asset.id}
                apiRoot={apiRoot}
                asset={asset}
                canEdit={props.canUpload}
                onCaption={(caption) => void patchAsset(apiRoot, asset.id, { caption }).catch((err) => setError(err.message))}
                onDelete={() => requestDelete(asset)}
                onMove={(dir) => void moveAsset('SHOP_PHOTO', asset.id, dir)}
                onDragStart={() => {
                  dragId.current = asset.id;
                }}
                onDrop={() => void dropAsset('SHOP_PHOTO', asset.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="hub-card__body">{HUB_EMPTY_PHOTOS}</p>
        )}
      </section>

      {showReviews ? (
      <section className="hub-card ks-glass-card" aria-labelledby="hub-team-photos-title">
        <h2 id="hub-team-photos-title" className="hub-card__title">
          {HUB_DETAILS_TEAM_PHOTOS_TITLE}
        </h2>
        {props.canUpload ? <HubUploader token={props.token} apiBase={props.apiBase} kind="TEAM_PHOTO" onUploaded={addAsset} /> : null}
        {teamPhotos.length ? (
          <ul className="hub-photo-grid">
            {teamPhotos.map((asset) => (
              <PhotoTile
                key={asset.id}
                apiRoot={apiRoot}
                asset={asset}
                canEdit={props.canUpload}
                onCaption={(caption) => void patchAsset(apiRoot, asset.id, { caption }).catch((err) => setError(err.message))}
                onDelete={() => requestDelete(asset)}
                onMove={(dir) => void moveAsset('TEAM_PHOTO', asset.id, dir)}
                onDragStart={() => {
                  dragId.current = asset.id;
                }}
                onDrop={() => void dropAsset('TEAM_PHOTO', asset.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="hub-card__body">{HUB_EMPTY_TEAM_PHOTOS}</p>
        )}
      </section>
      ) : null}

      <section className="hub-card ks-glass-card" aria-labelledby="hub-price-title">
        <h2 id="hub-price-title" className="hub-card__title">
          {HUB_DETAILS_PRICE_TITLE}
        </h2>
        <p className="hub-card__body">
          {HUB_DETAILS_PRICE_HEAD}. {HUB_UPLOAD_HINT_PRICE}
        </p>
        {props.canUpload ? (
          <HubUploader token={props.token} apiBase={props.apiBase} kind="PRICE_LIST" hint={HUB_UPLOAD_HINT_PRICE} onUploaded={addAsset} />
        ) : null}
        {prices.length ? (
          <ul className="hub-photo-grid hub-photo-grid--files">
            {prices.map((asset) => (
              <PhotoTile
                key={asset.id}
                apiRoot={apiRoot}
                asset={asset}
                canEdit={props.canUpload}
                compact
                onCaption={(caption) => void patchAsset(apiRoot, asset.id, { caption }).catch((err) => setError(err.message))}
                onDelete={() => requestDelete(asset)}
                onMove={(dir) => void moveAsset('PRICE_LIST', asset.id, dir)}
              />
            ))}
          </ul>
        ) : (
          <p className="hub-card__body">{HUB_EMPTY_PRICE}</p>
        )}
      </section>
      </>
      ) : null}

      {showAbout ? (
      <section className="hub-card ks-glass-card" aria-labelledby="hub-about-title">
        <h2 id="hub-about-title" className="hub-card__title">
          {HUB_DETAILS_ABOUT_TITLE}
        </h2>
        <p className="field__hint">{HUB_DETAILS_ABOUT_HINT}</p>
        <textarea
          id="hub-about"
          aria-labelledby="hub-about-title"
          className="textarea"
          maxLength={600}
          disabled={!props.canEditDetails}
          value={aboutText}
          onChange={(event) => {
            setAboutText(event.target.value);
            queueDetails({ aboutText: event.target.value });
          }}
        />
      </section>
      ) : null}

      {showReviews ? (
        props.canReview ? (
          <HubReviewCards
            token={props.token}
            apiBase={props.apiBase}
            canReview
            mode="full"
            shop={props.reviewShop ?? null}
            reviews={props.reviews ?? { SERVICES: null, TEAM: null, HOURS: null }}
          />
        ) : (
          <>
            <PlaceholderCard title={HUB_DETAILS_SERVICES_TITLE} />
            <PlaceholderCard title={HUB_DETAILS_TEAM_TITLE} />
            <PlaceholderCard title={HUB_DETAILS_HOURS_TITLE} />
          </>
        )
      ) : null}

      <div className="hub-toast" role="status" aria-live="polite">
        {toast ? (
          <>
            <span>{toast.text}</span>
            {toast.action ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={undoDelete}>
                {toast.action}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
