import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, Pipette, RotateCcw, Send, Sparkles } from '@/components/lucide-react';
import { useAppChrome } from './AppChrome';
import { AppStatus } from './AppStatus';
import type { AdminHubAppBodyProps } from './types';
import {
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_BG,
  ADMIN_HUB_COLOURS_BOOK,
  ADMIN_HUB_COLOURS_BW,
  ADMIN_HUB_COLOURS_CHOOSE_LINK,
  ADMIN_HUB_COLOURS_CHOOSE_SHORT,
  ADMIN_HUB_COLOURS_CONTRAST_FAIL,
  ADMIN_HUB_COLOURS_CONTRAST_OK,
  ADMIN_HUB_COLOURS_DARK,
  ADMIN_HUB_COLOURS_DEEPER,
  ADMIN_HUB_COLOURS_DEPTH,
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_EMPTY_ROLE,
  ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT,
  ADMIN_HUB_COLOURS_FINE_TUNE_MAIN,
  ADMIN_HUB_COLOURS_FOUND_IN,
  ADMIN_HUB_COLOURS_GUIDE,
  ADMIN_HUB_COLOURS_HEX,
  ADMIN_HUB_COLOURS_HEX_LABEL,
  ADMIN_HUB_COLOURS_INTENSITY,
  ADMIN_HUB_COLOURS_LIGHT,
  ADMIN_HUB_COLOURS_LIGHTER,
  ADMIN_HUB_COLOURS_LOOKS,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_COLOURS_MAIN_SEG,
  ADMIN_HUB_COLOURS_MAKE_DEEPER,
  ADMIN_HUB_COLOURS_MAKE_LIGHTER,
  ADMIN_HUB_COLOURS_MUTED,
  ADMIN_HUB_COLOURS_PICK_PHOTO,
  ADMIN_HUB_COLOURS_PRICES,
  ADMIN_HUB_COLOURS_QUICK,
  ADMIN_HUB_COLOURS_QUICK_HINT,
  ADMIN_HUB_COLOURS_RESET,
  ADMIN_HUB_COLOURS_SAVE,
  ADMIN_HUB_COLOURS_SEND,
  ADMIN_HUB_COLOURS_TOAST,
  ADMIN_HUB_COLOURS_VIVID,
  ADMIN_HUB_COLOURS_YOUR_LOGO,
} from '@/lib/adminHub/copy';
import {
  applyChroma,
  applyLightness,
  assignDefaultRoles,
  betterButtonText,
  depthGradient,
  evaluateContrast,
  hexToClampedOklch,
  intensityGradient,
  isLightHex,
  lightnessFromDepth,
  lightnessSteps,
  nameSwatch,
  normaliseHexColour,
  sliderDepth,
  swatchFromHex,
  type BrandBackgroundTone,
  type BrandColoursSource,
  type ColourRole,
  type ExtractedSwatch,
} from '@/lib/adminHub/colour';
import { extractFromLogoUrl, logoDisplayUrl } from '@/lib/adminHub/colour/runExtract';
import { HUB_SAVE_FAILED, HUB_SAVED, HUB_SAVING } from '@/lib/freePreview/hubCopy';

type SaveKind = 'idle' | 'saving' | 'saved' | 'error' | 'sent';

function hasEyedropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window;
}

function serviceRows(ctx: AdminHubAppBodyProps['ctx']): Array<{ name: string }> {
  const services = ctx.reviewShop?.services ?? [];
  return services.slice(0, 2).map((row) => ({ name: row.name }));
}

export default function ColoursApp({ ctx }: AdminHubAppBodyProps) {
  const logo = ctx.assets.find((asset) => asset.kind === 'LOGO') ?? null;
  const logoUrl = logo ? logoDisplayUrl(ctx.apiBase, logo) : null;
  const canEdit = ctx.canEditDetails;

  const [swatches, setSwatches] = useState<ExtractedSwatch[]>(() => {
    const saved = ctx.details.brandPaletteExtracted ?? [];
    return saved
      .map((row) => swatchFromHex(row.hex, row.share))
      .filter((row): row is ExtractedSwatch => Boolean(row));
  });
  const [mainHex, setMainHex] = useState(ctx.details.brandPrimaryColour ?? '');
  const [accentHex, setAccentHex] = useState(ctx.details.brandSecondaryColour ?? '');
  const [tone, setTone] = useState<BrandBackgroundTone>(ctx.details.brandBackgroundTone ?? 'DARK');
  const [source, setSource] = useState<BrandColoursSource>(ctx.details.brandColoursSource ?? 'LOGO');
  const [role, setRole] = useState<ColourRole>('main');
  const [extracting, setExtracting] = useState(Boolean(logoUrl));
  const [extractError, setExtractError] = useState<string | null>(null);
  const [hexOpen, setHexOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState('');
  const [save, setSave] = useState<SaveKind>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [logoExtracted, setLogoExtracted] = useState<ExtractedSwatch[] | null>(null);

  const applyExtracted = useCallback((rows: ExtractedSwatch[], overwriteRoles: boolean) => {
    setSwatches(rows);
    setLogoExtracted(rows);
    if (!overwriteRoles) return;
    const roles = assignDefaultRoles(rows);
    setMainHex(roles.main?.hex ?? '');
    setAccentHex(roles.accent?.hex ?? '');
    setSource('LOGO');
  }, []);

  useEffect(() => {
    if (!logoUrl) {
      setExtracting(false);
      return;
    }
    let cancelled = false;
    setExtracting(true);
    setExtractError(null);
    void extractFromLogoUrl(logoUrl)
      .then((rows) => {
        if (cancelled) return;
        const hadSaved = Boolean(ctx.details.brandPrimaryColour || ctx.details.brandPaletteExtracted?.length);
        applyExtracted(rows, !hadSaved);
        setExtracting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setExtractError(HUB_SAVE_FAILED);
        setExtracting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyExtracted, ctx.details.brandPaletteExtracted?.length, ctx.details.brandPrimaryColour, logoUrl]);

  const main = mainHex ? swatchFromHex(mainHex) : null;
  const accent = accentHex ? swatchFromHex(accentHex) : null;
  const selectedHex = role === 'main' ? mainHex : accentHex;
  const selected = role === 'main' ? main : accent;
  const contrast = evaluateContrast({
    mainHex: mainHex || null,
    accentHex: accentHex || null,
    tone,
  });
  const bw = Boolean(logoExtracted && assignDefaultRoles(logoExtracted).blackAndWhite && !mainHex);
  const picks = selectedHex ? lightnessSteps(selectedHex) : [];
  const depth = selected ? sliderDepth(selected.oklch.L) : 0.5;
  const intensity = selected ? Math.min(1, selected.oklch.C / 0.18) : 0.4;
  const depthStops = selectedHex ? depthGradient(selectedHex) : null;
  const intensityStops = selectedHex ? intensityGradient(selectedHex) : null;
  const services = serviceRows(ctx);
  const shopLabel = ctx.shopName.trim() || 'Your shop';
  const buttonText = accentHex ? betterButtonText(accentHex) : '#FFFFFF';
  const eyedropper = hasEyedropper();

  const payload = useCallback(
    (send: boolean, nextSource = source) => ({
      brandPrimaryColour: mainHex || null,
      brandSecondaryColour: accentHex || null,
      brandBackgroundTone: tone,
      brandColoursSource: nextSource,
      brandPaletteExtracted: swatches.slice(0, 5).map((row) => ({ hex: row.hex, share: row.share })),
      send,
    }),
    [accentHex, mainHex, source, swatches, tone],
  );

  const persist = useCallback(
    async (send: boolean, nextSource = source) => {
      if (!canEdit) return;
      setSave('saving');
      setSource(nextSource);
      try {
        const response = await fetch(`${ctx.apiBase}/brand-colours`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload(send, nextSource)),
        });
        const body = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !body.ok) throw new Error(body.error || HUB_SAVE_FAILED);
        setSave(send ? 'sent' : 'saved');
        if (send) setToast(ADMIN_HUB_COLOURS_TOAST);
      } catch {
        setSave('error');
      }
    },
    [canEdit, ctx.apiBase, payload, source],
  );

  const setRoleHex = (next: string, nextSource: BrandColoursSource = source) => {
    const hex = normaliseHexColour(next);
    if (!hex) return;
    if (role === 'main') setMainHex(hex);
    else setAccentHex(hex);
    setSource(nextSource);
  };

  const applyContrastFix = (hex: string) => {
    if (!contrast.buttonPass) setAccentHex(hex);
    else setMainHex(hex);
  };

  const onSwatch = (swatch: ExtractedSwatch) => {
    if (role === 'main') setMainHex(swatch.hex);
    else setAccentHex(swatch.hex);
    setSource('LOGO');
  };

  const resetToLogo = () => {
    if (!logoExtracted) return;
    applyExtracted(logoExtracted, true);
  };

  const onHexSubmit = () => {
    const hex = normaliseHexColour(hexDraft);
    if (!hex) return;
    setRoleHex(hex, 'MANUAL');
    if (!swatches.some((row) => row.hex === hex)) {
      const extra = swatchFromHex(hex, 0);
      if (extra) setSwatches((rows) => [...rows, extra].slice(0, 5));
    }
    setHexOpen(false);
  };

  const pickFromPhoto = async () => {
    const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Ctor) return;
    try {
      const result = await new Ctor().open();
      const hex = normaliseHexColour(result.sRGBHex);
      if (hex) setRoleHex(hex, 'MANUAL');
    } catch {
      /* cancelled */
    }
  };

  const headerAction = useMemo(
    () =>
      logoExtracted ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={resetToLogo} disabled={!canEdit}>
          <RotateCcw width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
          {ADMIN_HUB_COLOURS_RESET}
        </button>
      ) : null,
    [canEdit, logoExtracted],
  );

  const footer = useMemo(
    () => (
      <>
        <p className="admin-hub-colours__choose">
          Not sure?{' '}
          <button
            type="button"
            className="btn btn--link"
            disabled={!canEdit || save === 'saving'}
            onClick={() => void persist(true, 'KERSIVO_CHOOSES')}
          >
            {ADMIN_HUB_COLOURS_CHOOSE_LINK}
          </button>{' '}
          — we&apos;ll pick from your logo.
        </p>
        <button
          type="button"
          className="btn btn--outline"
          disabled={!canEdit || save === 'saving'}
          onClick={() => void persist(false)}
        >
          {save === 'saving' ? HUB_SAVING : save === 'saved' ? HUB_SAVED : ADMIN_HUB_COLOURS_SAVE}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canEdit || save === 'saving'}
          onClick={() => void persist(true)}
        >
          <Send width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
          {ADMIN_HUB_COLOURS_SEND}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm admin-hub-colours__choose-mobile"
          disabled={!canEdit || save === 'saving'}
          onClick={() => void persist(true, 'KERSIVO_CHOOSES')}
        >
          {ADMIN_HUB_COLOURS_CHOOSE_SHORT}
        </button>
      </>
    ),
    [canEdit, persist, save],
  );

  useAppChrome({ headerAction, footer });

  if (extracting && !swatches.length && !mainHex) {
    return <AppStatus state="loading" />;
  }

  const liveHero = {
    background:
      tone === 'DARK'
        ? `radial-gradient(90% 90% at 85% 0%, ${accentHex || '#c9a24a'}59, transparent 55%), linear-gradient(160deg, ${mainHex || '#1f6f6b'}, #0b1f1e)`
        : `linear-gradient(160deg, ${mainHex || '#1f6f6b'}, ${accentHex || '#c9a24a'})`,
    color: tone === 'DARK' ? '#f2e8d5' : '#141414',
  };

  return (
    <div className="admin-hub-colours" data-testid="admin-hub-colours">
      {toast ? (
        <p className="admin-hub-colours__toast" role="status">
          {toast}
        </p>
      ) : null}
      {save === 'error' ? (
        <p className="admin-hub-colours__error" role="alert">
          {HUB_SAVE_FAILED}
        </p>
      ) : null}

      <div className="admin-hub-colours__preview-first">
        <LivePreview
          shop={shopLabel}
          hero={liveHero}
          mainHex={mainHex || '#1F6F6B'}
          accentHex={accentHex || '#C9A24A'}
          buttonText={buttonText}
          services={services}
          compact
        />
      </div>

      <div className="admin-hub-cp">
        <section className="admin-hub-cp__panel">
          <p className="admin-hub-cp__label">
            <ImagePlus width={12} height={12} strokeWidth={1.8} aria-hidden="true" />
            {ADMIN_HUB_COLOURS_YOUR_LOGO}
          </p>
          <div className="admin-hub-logo-pair">
            <div className="admin-hub-logo-pair__dark">
              {logoUrl ? <img src={logoUrl} alt="" /> : <span>{shopLabel.slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="admin-hub-logo-pair__light">
              {logoUrl ? <img src={logoUrl} alt="" /> : <span>{shopLabel.slice(0, 2).toUpperCase()}</span>}
            </div>
          </div>
          <p className="admin-hub-cp__label">
            <Sparkles width={12} height={12} strokeWidth={1.8} aria-hidden="true" />
            {ADMIN_HUB_COLOURS_FOUND_IN}
          </p>
          {extracting ? <div className="hub-skel hub-skel--card" aria-busy="true" /> : null}
          {extractError ? (
            <AppStatus state="error" error={extractError} onRetry={() => window.location.reload()} />
          ) : null}
          {!extracting && !swatches.length && !logoUrl ? <p className="admin-hub-colours__hint">{ADMIN_HUB_COLOURS_EMPTY}</p> : null}
          {bw ? <p className="admin-hub-colours__hint">{ADMIN_HUB_COLOURS_BW}</p> : null}
          <div className="admin-hub-extract">
            {swatches.map((swatch) => {
              const assigned =
                swatch.hex === mainHex ? ADMIN_HUB_COLOURS_MAIN : swatch.hex === accentHex ? ADMIN_HUB_COLOURS_ACCENT : null;
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  className={`admin-hub-extract__row${assigned ? ' is-sel' : ''}`}
                  data-testid={`admin-hub-swatch-${swatch.hex.replace('#', '')}`}
                  onClick={() => onSwatch(swatch)}
                  disabled={!canEdit}
                >
                  <span className="admin-hub-extract__chip" style={{ background: swatch.hex }} />
                  <span>
                    <span className="admin-hub-extract__name">
                      {swatch.name} <span className="admin-hub-extract__hex">{swatch.hex}</span>
                    </span>
                    <span className="admin-hub-share" aria-hidden="true">
                      <span style={{ width: `${Math.round(swatch.share * 100)}%` }} />
                    </span>
                  </span>
                  {assigned ? (
                    <span className={`admin-hub-rolechip${assigned === ADMIN_HUB_COLOURS_ACCENT ? ' admin-hub-rolechip--2' : ''}`}>
                      {assigned}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="admin-hub-swatch-row" aria-label={ADMIN_HUB_COLOURS_FOUND_IN}>
            {swatches.map((swatch) => (
              <button
                key={`m-${swatch.hex}`}
                type="button"
                className={`admin-hub-swatch-row__item${swatch.hex === mainHex || swatch.hex === accentHex ? ' is-on' : ''}`}
                onClick={() => onSwatch(swatch)}
                disabled={!canEdit}
              >
                <span style={{ background: swatch.hex }} />
                <small>
                  {swatch.hex === mainHex
                    ? ADMIN_HUB_COLOURS_MAIN
                    : swatch.hex === accentHex
                      ? ADMIN_HUB_COLOURS_ACCENT
                      : swatch.name}
                </small>
              </button>
            ))}
          </div>
          <div className="admin-hub-colours__tools">
            {eyedropper ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void pickFromPhoto()} disabled={!canEdit}>
                <Pipette width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
                {ADMIN_HUB_COLOURS_PICK_PHOTO}
              </button>
            ) : null}
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setHexOpen((v) => !v)} disabled={!canEdit}>
              {ADMIN_HUB_COLOURS_HEX}
            </button>
          </div>
          {hexOpen ? (
            <div className="admin-hub-colours__hex">
              <label>
                {ADMIN_HUB_COLOURS_HEX_LABEL}
                <input
                  value={hexDraft}
                  onChange={(event) => setHexDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onHexSubmit();
                  }}
                  placeholder="#1F6F6B"
                  spellCheck={false}
                />
              </label>
              <button type="button" className="btn btn--outline btn--sm" onClick={onHexSubmit}>
                Use
              </button>
            </div>
          ) : null}
        </section>

        <section>
          <div className="admin-hub-roles">
            {(['main', 'accent'] as const).map((id) => {
              const hex = id === 'main' ? mainHex : accentHex;
              const lch = hex ? hexToClampedOklch(hex) : null;
              const named = lch ? nameSwatch(lch) : ADMIN_HUB_COLOURS_EMPTY_ROLE;
              return (
                <button
                  key={id}
                  type="button"
                  className={`admin-hub-role${role === id ? ' is-active' : ''}`}
                  data-testid={`admin-hub-role-${id}`}
                  onClick={() => setRole(id)}
                  aria-pressed={role === id}
                >
                  <span className="admin-hub-role__sw" style={{ background: hex || 'transparent' }} />
                  <span>
                    <span className="admin-hub-role__k">{id === 'main' ? ADMIN_HUB_COLOURS_MAIN : ADMIN_HUB_COLOURS_ACCENT}</span>
                    <span className="admin-hub-role__v">{named}</span>
                  </span>
                  <span className="admin-hub-role__hex">{hex || '—'}</span>
                </button>
              );
            })}
          </div>
          <div className="admin-hub-seg" role="tablist" aria-label="Role">
            <button type="button" className={role === 'main' ? 'is-on' : ''} onClick={() => setRole('main')} role="tab" aria-selected={role === 'main'}>
              {ADMIN_HUB_COLOURS_MAIN_SEG}
            </button>
            <button type="button" className={role === 'accent' ? 'is-on' : ''} onClick={() => setRole('accent')} role="tab" aria-selected={role === 'accent'}>
              {ADMIN_HUB_COLOURS_ACCENT}
            </button>
          </div>
          <div className="admin-hub-cp__panel admin-hub-tuner">
            <p className="admin-hub-cp__label">
              {role === 'main' ? ADMIN_HUB_COLOURS_FINE_TUNE_MAIN : ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT}
            </p>
            <label className="admin-hub-slider">
              <span className="admin-hub-slider__top">
                <span>{ADMIN_HUB_COLOURS_LIGHTER}</span>
                <b>{ADMIN_HUB_COLOURS_DEPTH}</b>
                <span>{ADMIN_HUB_COLOURS_DEEPER}</span>
              </span>
              <span
                className="admin-hub-track"
                style={{
                  ['--admin-hub-thumb' as string]: selectedHex || '#1f6f6b',
                  background: depthStops
                    ? `linear-gradient(90deg, ${depthStops.lighter}, ${depthStops.mid}, ${depthStops.deeper})`
                    : undefined,
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(depth * 100)}
                  disabled={!canEdit || !selectedHex}
                  aria-valuetext={`Depth ${Math.round(depth * 100)}%`}
                  onChange={(event) => setRoleHex(applyLightness(selectedHex, lightnessFromDepth(Number(event.target.value) / 100)))}
                />
              </span>
            </label>
            <label className="admin-hub-slider">
              <span className="admin-hub-slider__top">
                <span>{ADMIN_HUB_COLOURS_MUTED}</span>
                <b>{ADMIN_HUB_COLOURS_INTENSITY}</b>
                <span>{ADMIN_HUB_COLOURS_VIVID}</span>
              </span>
              <span
                className="admin-hub-track"
                style={{
                  ['--admin-hub-thumb' as string]: selectedHex || '#1f6f6b',
                  background: intensityStops
                    ? `linear-gradient(90deg, ${intensityStops.muted}, ${intensityStops.mid}, ${intensityStops.vivid})`
                    : undefined,
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(intensity * 100)}
                  disabled={!canEdit || !selectedHex}
                  aria-valuetext={`Intensity ${Math.round(intensity * 100)}%`}
                  onChange={(event) => setRoleHex(applyChroma(selectedHex, (Number(event.target.value) / 100) * 0.18))}
                />
              </span>
            </label>
            <div>
              <div className="admin-hub-slider__top">
                <span>{ADMIN_HUB_COLOURS_QUICK}</span>
                <span>{ADMIN_HUB_COLOURS_QUICK_HINT}</span>
              </div>
              <div className="admin-hub-variants">
                {picks.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={hex === selectedHex ? 'is-cur' : ''}
                    style={{ background: hex }}
                    aria-label={hex}
                    disabled={!canEdit}
                    onClick={() => setRoleHex(hex)}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="admin-hub-slider__top">
                <span>{ADMIN_HUB_COLOURS_BG}</span>
              </div>
              <div className="admin-hub-tone">
                <button type="button" className={tone === 'DARK' ? 'is-on' : ''} onClick={() => setTone('DARK')} disabled={!canEdit}>
                  <i style={{ background: '#0e1514' }} />
                  {ADMIN_HUB_COLOURS_DARK}
                </button>
                <button type="button" className={tone === 'LIGHT' ? 'is-on' : ''} onClick={() => setTone('LIGHT')} disabled={!canEdit}>
                  <i style={{ background: '#f4efe6' }} />
                  {ADMIN_HUB_COLOURS_LIGHT}
                </button>
              </div>
            </div>
            <ContrastRow contrast={contrast} canEdit={canEdit} onFix={applyContrastFix} />
          </div>
        </section>

        <section className="admin-hub-colours__looks">
          <p className="admin-hub-cp__label">{ADMIN_HUB_COLOURS_LOOKS}</p>
          <LivePreview
            shop={shopLabel}
            hero={liveHero}
            mainHex={mainHex || '#1F6F6B'}
            accentHex={accentHex || '#C9A24A'}
            buttonText={buttonText}
            services={services}
          />
          <ContrastRow contrast={contrast} canEdit={canEdit} onFix={applyContrastFix} />
          <p className="admin-hub-colours__guide">{ADMIN_HUB_COLOURS_GUIDE}</p>
        </section>
      </div>
    </div>
  );
}

function ContrastRow(props: {
  contrast: ReturnType<typeof evaluateContrast>;
  canEdit: boolean;
  onFix: (hex: string) => void;
}) {
  if (props.contrast.pass) {
    return (
      <p className="admin-hub-check admin-hub-check--ok">
        <Check width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
        {ADMIN_HUB_COLOURS_CONTRAST_OK}
      </p>
    );
  }
  return (
    <p className="admin-hub-check admin-hub-check--warn">
      {ADMIN_HUB_COLOURS_CONTRAST_FAIL}
      {props.contrast.fixHex ? (
        <button type="button" className="btn btn--ghost btn--sm" disabled={!props.canEdit} onClick={() => props.onFix(props.contrast.fixHex!)}>
          {props.contrast.fixLabel === 'lighter' ? ADMIN_HUB_COLOURS_MAKE_LIGHTER : ADMIN_HUB_COLOURS_MAKE_DEEPER}
        </button>
      ) : null}
    </p>
  );
}

function LivePreview(props: {
  shop: string;
  hero: { background: string; color: string };
  mainHex: string;
  accentHex: string;
  buttonText: string;
  services: Array<{ name: string }>;
  compact?: boolean;
}) {
  const light = isLightHex(props.buttonText);
  return (
    <div className={`admin-hub-livep${props.compact ? ' admin-hub-livep--compact' : ''}`} aria-hidden="true">
      <div className="admin-hub-livep__hero" style={props.hero}>
        {!props.compact ? (
          <div className="admin-hub-livep__nav">
            <span>{props.shop}</span>
            <span style={{ background: props.accentHex, color: props.buttonText }}>Book</span>
          </div>
        ) : null}
        <div className="admin-hub-livep__h">{props.shop}</div>
        <div className="admin-hub-livep__btns">
          <span style={{ background: props.accentHex, color: props.buttonText }}>{ADMIN_HUB_COLOURS_BOOK}</span>
          {!props.compact ? (
            <span style={{ border: `1px solid ${light ? 'rgba(20,20,20,.35)' : 'rgba(242,232,213,.4)'}`, color: 'inherit' }}>
              {ADMIN_HUB_COLOURS_PRICES}
            </span>
          ) : null}
        </div>
      </div>
      {!props.compact ? (
        <div
          className="admin-hub-livep__body"
          style={{ background: isLightHex(props.hero.color) ? '#0e1514' : '#f4efe6', color: props.hero.color }}
        >
          {(props.services.length ? props.services : [{ name: 'Cut' }, { name: 'Beard' }]).map((row) => (
            <div key={row.name} className="admin-hub-livep__svc">
              <span>{row.name}</span>
              <b style={{ color: props.accentHex }}>·</b>
            </div>
          ))}
          <div className="admin-hub-livep__slots">
            <span style={{ background: props.mainHex, color: '#fff' }}>10:00</span>
            <span>10:30</span>
            <span>11:15</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
