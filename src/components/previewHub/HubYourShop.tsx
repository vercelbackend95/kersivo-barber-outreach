import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PreviewHubAssetKind } from '@prisma/client';
import { extractLogoHexes, HEX_COLOUR_RE } from '@/lib/freePreview/extractLogoColours';
import {
  HUB_CAPTION_LABEL,
  HUB_CAPTION_PLACEHOLDER,
  HUB_DELETE,
  HUB_DETAILS_ABOUT_HINT,
  HUB_DETAILS_ABOUT_TITLE,
  HUB_DETAILS_INSTAGRAM_HINT,
  HUB_DETAILS_INSTAGRAM_LABEL,
  HUB_DETAILS_BRAND_TITLE,
  HUB_DETAILS_COLOUR_PRIMARY,
  HUB_DETAILS_COLOUR_SECONDARY,
  HUB_DETAILS_HEX_LABEL,
  HUB_DETAILS_HOURS_TITLE,
  HUB_DETAILS_OTHER_TITLE,
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
  HUB_JUMP_LOGO,
  HUB_JUMP_OTHER,
  HUB_JUMP_PHOTOS,
  HUB_JUMP_PRICE,
  HUB_JUMP_TEAM,
  HUB_JUMP_TEXT,
  HUB_WEBSITE_EXTRA_COUNT,
  HUB_WEBSITE_EXTRA_HINT,
  HUB_WEBSITE_EXTRA_LABEL,
  HUB_WEBSITE_TEXT_INTRO,
  HUB_WEBSITE_TEXT_TITLE,
  HUB_EMPTY_LOGO,
  HUB_EMPTY_OTHER,
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
  HUB_UPLOAD_HINT_OTHER,
} from '@/lib/freePreview/hubCopy';
import { hubApiRoot } from '@/lib/adminHub/links';
import type { AdminHubAddWebsiteItem } from '@/lib/adminHub/addMenu';
import { HubUploader, type HubUploadedAsset } from './HubUploader';
import { HubReviewCards, type HubReviewMap } from './HubReviewCards';
import type { HubReviewShopData } from '@/lib/freePreview/hubReviews.shared';

export type HubShopDetails = {
  brandPrimaryColour: string | null;
  brandSecondaryColour: string | null;
  styleNotes: string | null;
  aboutText: string | null;
  instagramUrl?: string | null;
  websiteExtraText?: string | null;
  brandBackgroundTone?: 'DARK' | 'LIGHT' | null;
  brandColoursSource?: 'LOGO' | 'MANUAL' | 'KERSIVO_CHOOSES' | null;
  brandPaletteExtracted?: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt?: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const UNDO_MS = 5000;
const AUTOSAVE_MS = 700;
const OTHER_MAX = 10;
const EXTRA_MAX = 2000;

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

const JUMP_CHIPS: Array<{ id: AdminHubAddWebsiteItem; label: string; check?: boolean }> = [
  { id: 'photos', label: HUB_JUMP_PHOTOS },
  { id: 'logo', label: HUB_JUMP_LOGO, check: true },
  { id: 'text', label: HUB_JUMP_TEXT, check: true },
  { id: 'team-photos', label: HUB_JUMP_TEAM },
  { id: 'price-list', label: HUB_JUMP_PRICE },
  { id: 'other', label: HUB_JUMP_OTHER },
];

function JumpChips({
  counts,
}: {
  counts: Record<AdminHubAddWebsiteItem, number>;
}) {
  const jump = (id: AdminHubAddWebsiteItem) => {
    const node = document.getElementById(id);
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    const heading = node.querySelector('h2');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };
  return (
    <nav className="hub-jump" aria-label="Add to your website" data-testid="hub-jump">
      {JUMP_CHIPS.map((chip) => {
        const count = counts[chip.id];
        const mark = chip.check ? (count > 0 ? ' ✓' : '') : count > 0 ? ` ${count}` : '';
        return (
          <button
            key={chip.id}
            type="button"
            className={`hub-jump__chip${count > 0 ? ' is-done' : ''}`}
            onClick={() => jump(chip.id)}
          >
            {chip.label}
            {mark}
          </button>
        );
      })}
    </nav>
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
  focus?: 'logo' | 'photos' | 'about' | 'materials';
  /** Scroll the materials app to this block (`?item=`). */
  highlight?: AdminHubAddWebsiteItem | null;
  /** When false, the page H1 is omitted (the app window already has a title). */
  chrome?: boolean;
}) {
  const focus = props.focus;
  const chrome = props.chrome !== false && !focus;
  const showLogo = !focus || focus === 'logo' || focus === 'materials';
  const showPhotos = !focus || focus === 'photos' || focus === 'materials';
  const showAbout = !focus || focus === 'about' || focus === 'materials';
  const showTeamPhotos = !focus || focus === 'materials';
  const showPrice = !focus || focus === 'photos' || focus === 'materials';
  const showOther = focus === 'materials';
  const showJump = focus === 'materials';
  const showReviews = !focus;
  const showBrandExtras = showLogo && !focus;
  const apiRoot = hubApiRoot(props);
  const [assets, setAssets] = useState(props.assets);
  const [details, setDetails] = useState(props.details);
  const [primary, setPrimary] = useState(props.details.brandPrimaryColour ?? '');
  const [secondary, setSecondary] = useState(props.details.brandSecondaryColour ?? '');
  const [styleNotes, setStyleNotes] = useState(props.details.styleNotes ?? '');
  const [aboutText, setAboutText] = useState(props.details.aboutText ?? '');
  const [instagramUrl, setInstagramUrl] = useState(props.details.instagramUrl ?? '');
  const [websiteExtraText, setWebsiteExtraText] = useState(props.details.websiteExtraText ?? '');
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
  const others = assets.filter((asset) => asset.kind === 'OTHER');
  const logo = logos[logos.length - 1] ?? null;

  useEffect(() => {
    const item = props.highlight;
    if (!item) return;
    const node = document.getElementById(item);
    if (!node) return;
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    node.classList.add('is-hub-add-target');
    const heading = node.querySelector('h2');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    return () => node.classList.remove('is-hub-add-target');
  }, [props.highlight]);

  const addAsset = (asset: HubUploadedAsset) => {
    knownAssets.current = [...knownAssets.current.filter((row) => row.id !== asset.id), asset];
    setAssets((current) => [...current, asset]);
    setError(null);
    window.dispatchEvent(
      new CustomEvent('admin-hub:asset-uploaded', { detail: { kind: asset.kind, asset } }),
    );
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
        if (payload.details.instagramUrl !== undefined) {
          setInstagramUrl(payload.details.instagramUrl ?? '');
        }
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

      {showJump ? (
        <JumpChips
          counts={{
            photos: photos.length,
            logo: logos.length,
            text: [aboutText, instagramUrl, websiteExtraText].some((value) => value.trim()) ? 1 : 0,
            'team-photos': teamPhotos.length,
            'price-list': prices.length,
            other: others.length,
          }}
        />
      ) : null}

      {showPhotos ? (
      <section className="hub-card ks-glass-card" id="photos" aria-labelledby="hub-photos-title">
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
      ) : null}

      {showLogo ? (
      <section className="hub-card ks-glass-card" id="logo" aria-labelledby="hub-brand-title">
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

      {showAbout ? (
      <section className="hub-card ks-glass-card" id="text" aria-labelledby="hub-website-text-title">
        <h2 id="hub-website-text-title" className="hub-card__title">
          {HUB_WEBSITE_TEXT_TITLE}
        </h2>
        <p className="hub-card__body">{HUB_WEBSITE_TEXT_INTRO}</p>
        <div className="field">
          <label className="field__label" htmlFor="hub-about">
            {HUB_DETAILS_ABOUT_TITLE}
          </label>
          <p className="field__hint" id="hub-about-hint">
            {HUB_DETAILS_ABOUT_HINT}
          </p>
          <textarea
            id="hub-about"
            aria-describedby="hub-about-hint"
            className="textarea"
            maxLength={600}
            disabled={!props.canEditDetails}
            value={aboutText}
            onChange={(event) => {
              setAboutText(event.target.value);
              queueDetails({ aboutText: event.target.value });
            }}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="hub-instagram">
            {HUB_DETAILS_INSTAGRAM_LABEL}
          </label>
          <p className="field__hint" id="hub-instagram-hint">
            {HUB_DETAILS_INSTAGRAM_HINT}
          </p>
          <input
            id="hub-instagram"
            className="input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            disabled={!props.canEditDetails}
            value={instagramUrl}
            aria-describedby="hub-instagram-hint"
            onChange={(event) => {
              setInstagramUrl(event.target.value);
              queueDetails({ instagramUrl: event.target.value });
            }}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="hub-website-extra">
            {HUB_WEBSITE_EXTRA_LABEL}
          </label>
          <p className="field__hint" id="hub-website-extra-hint">
            {HUB_WEBSITE_EXTRA_HINT}
          </p>
          <textarea
            id="hub-website-extra"
            aria-describedby="hub-website-extra-hint hub-website-extra-count"
            className="textarea"
            maxLength={EXTRA_MAX}
            disabled={!props.canEditDetails}
            value={websiteExtraText}
            onChange={(event) => {
              setWebsiteExtraText(event.target.value);
              queueDetails({ websiteExtraText: event.target.value });
            }}
          />
          <p className="field__hint hub-charcount" id="hub-website-extra-count">
            {HUB_WEBSITE_EXTRA_COUNT(websiteExtraText.length, EXTRA_MAX)}
          </p>
        </div>
      </section>
      ) : null}

      {showTeamPhotos ? (
      <section className="hub-card ks-glass-card" id="team-photos" aria-labelledby="hub-team-photos-title">
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

      {showPrice ? (
      <section className="hub-card ks-glass-card" id="price-list" aria-labelledby="hub-price-title">
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
      ) : null}
      {showOther ? (
      <section className="hub-card ks-glass-card" id="other" aria-labelledby="hub-other-title">
        <h2 id="hub-other-title" className="hub-card__title">
          {HUB_DETAILS_OTHER_TITLE}
        </h2>
        <p className="hub-card__body">{HUB_UPLOAD_HINT_OTHER}</p>
        {props.canUpload ? (
          <HubUploader
            token={props.token}
            apiBase={props.apiBase}
            kind="OTHER"
            hint={HUB_UPLOAD_HINT_OTHER}
            remaining={Math.max(0, OTHER_MAX - others.length)}
            onUploaded={addAsset}
          />
        ) : null}
        {others.length ? (
          <ul className="hub-photo-grid hub-photo-grid--files">
            {others.map((asset) => (
              <PhotoTile
                key={asset.id}
                apiRoot={apiRoot}
                asset={asset}
                canEdit={props.canUpload}
                compact
                onCaption={(caption) => void patchAsset(apiRoot, asset.id, { caption }).catch((err) => setError(err.message))}
                onDelete={() => requestDelete(asset)}
                onMove={(dir) => void moveAsset('OTHER', asset.id, dir)}
              />
            ))}
          </ul>
        ) : (
          <p className="hub-card__body">{HUB_EMPTY_OTHER}</p>
        )}
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
