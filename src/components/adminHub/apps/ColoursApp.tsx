import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  ImagePlus,
  Pipette,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  X,
} from '@/components/lucide-react';
import { AdminHubConfirmDialog } from '@/components/adminHub/AdminHubConfirmDialog';
import { useAppChrome } from './AppChrome';
import { AppStatus } from './AppStatus';
import type { AdminHubAppBodyProps } from './types';
import {
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_BG,
  ADMIN_HUB_COLOURS_BOOK,
  ADMIN_HUB_COLOURS_BW,
  ADMIN_HUB_COLOURS_CHOOSE_LINK,
  ADMIN_HUB_COLOURS_CHOOSE_PREFIX,
  ADMIN_HUB_COLOURS_CHOOSE_SHORT,
  ADMIN_HUB_COLOURS_CHOOSE_SUFFIX,
  ADMIN_HUB_COLOURS_CONFIRM_BACK,
  ADMIN_HUB_COLOURS_CONFIRM_BODY,
  ADMIN_HUB_COLOURS_CONFIRM_TITLE,
  ADMIN_HUB_COLOURS_CONFIRM_YES,
  ADMIN_HUB_COLOURS_CONTRAST_BUTTON,
  ADMIN_HUB_COLOURS_CONTRAST_LOW,
  ADMIN_HUB_COLOURS_CONTRAST_MAIN,
  ADMIN_HUB_COLOURS_CONTRAST_PASS,
  ADMIN_HUB_COLOURS_COPIED,
  ADMIN_HUB_COLOURS_COPY,
  ADMIN_HUB_COLOURS_COPY_HEX,
  ADMIN_HUB_COLOURS_DARK,
  ADMIN_HUB_COLOURS_DEEPER,
  ADMIN_HUB_COLOURS_DEPTH,
  ADMIN_HUB_COLOURS_DRAFT_TOAST,
  ADMIN_HUB_COLOURS_DRAFT_TOAST_FAILED,
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_EXTRACT_FAILED,
  ADMIN_HUB_COLOURS_EMPTY_ROLE,
  ADMIN_HUB_COLOURS_FIND_AGAIN,
  ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT,
  ADMIN_HUB_COLOURS_FINE_TUNE_MAIN,
  ADMIN_HUB_COLOURS_FOUND_IN,
  ADMIN_HUB_COLOURS_GUIDE,
  ADMIN_HUB_COLOURS_HEX,
  ADMIN_HUB_COLOURS_HEX_ERROR_CHARS,
  ADMIN_HUB_COLOURS_HEX_ERROR_LENGTH,
  ADMIN_HUB_COLOURS_HEX_LABEL,
  ADMIN_HUB_COLOURS_HEX_USE,
  ADMIN_HUB_COLOURS_INTENSITY,
  ADMIN_HUB_COLOURS_LIGHT,
  ADMIN_HUB_COLOURS_LIGHTER,
  ADMIN_HUB_COLOURS_LOCKED_NOTICE,
  ADMIN_HUB_COLOURS_LOOKS,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_COLOURS_MAIN_SEG,
  ADMIN_HUB_COLOURS_MAKE_ACCENT_DEEPER,
  ADMIN_HUB_COLOURS_MAKE_ACCENT_LIGHTER,
  ADMIN_HUB_COLOURS_MAKE_MAIN_DEEPER,
  ADMIN_HUB_COLOURS_MAKE_MAIN_LIGHTER,
  ADMIN_HUB_COLOURS_MESSAGE_US,
  ADMIN_HUB_COLOURS_MUTED,
  ADMIN_HUB_COLOURS_NEW_LOGO,
  ADMIN_HUB_COLOURS_NO_ACCENT,
  ADMIN_HUB_COLOURS_NO_LOGO,
  ADMIN_HUB_COLOURS_PALETTE,
  ADMIN_HUB_COLOURS_PICK_MAIN,
  ADMIN_HUB_COLOURS_PICK_SCREEN,
  ADMIN_HUB_COLOURS_PRICES,
  ADMIN_HUB_COLOURS_QUICK,
  ADMIN_HUB_COLOURS_QUICK_HINT,
  ADMIN_HUB_COLOURS_READABILITY,
  ADMIN_HUB_COLOURS_RESET,
  ADMIN_HUB_COLOURS_ROLE_GROUP,
  ADMIN_HUB_COLOURS_SAME_HEX,
  ADMIN_HUB_COLOURS_SAVE,
  ADMIN_HUB_COLOURS_SAVE_FAILED,
  ADMIN_HUB_COLOURS_SEND,
  ADMIN_HUB_COLOURS_SENDING,
  ADMIN_HUB_COLOURS_SENT_ON,
  ADMIN_HUB_COLOURS_SLIDER_WORDS,
  ADMIN_HUB_COLOURS_SOURCE_KERSIVO,
  ADMIN_HUB_COLOURS_SOURCE_LABEL,
  ADMIN_HUB_COLOURS_SOURCE_LOGO,
  ADMIN_HUB_COLOURS_SOURCE_MANUAL,
  ADMIN_HUB_COLOURS_SWAP,
  ADMIN_HUB_COLOURS_SWAP_LABEL,
  ADMIN_HUB_COLOURS_UNDO,
  ADMIN_HUB_COLOURS_UPLOAD,
  ADMIN_HUB_COLOURS_VIVID,
  ADMIN_HUB_COLOURS_YOUR_LOGO,
  formatBrandSubmittedDate,
} from '@/lib/adminHub/copy';
import { ADMIN_HUB_LINKS } from '@/lib/adminHub/links';
import { adminHubMaterialsHref } from '@/lib/adminHub/addMenu';
import {
  addToPalette,
  assignDefaultRoles,
  betterButtonText,
  chromaFromRelative,
  clearAccent,
  commitEdit,
  depthGradient,
  evaluateContrast,
  formatContrastRatio,
  hexToClampedOklch,
  intensityGradient,
  lightnessFromDepth,
  lightnessSteps,
  MAX_PALETTE,
  mergePalette,
  nameSwatch,
  normaliseHexColour,
  oklchToHex,
  parseCssColour,
  parseHexInput,
  relativeChroma,
  setRoleColour,
  siteBackgroundHex,
  siteTextHex,
  sliderDepth,
  swapRoles,
  swatchFromHex,
  undoEdit,
  type BrandBackgroundTone,
  type BrandColoursSource,
  type ColourRole,
  type ColourSnapshot,
  type ContrastCheck,
  type ExtractedSwatch,
  type UndoState,
} from '@/lib/adminHub/colour';
import { extractFromLogoUrl, logoDisplayUrl } from '@/lib/adminHub/colour/runExtract';
import { currentHubLogo, currentHubLogoOptionsFromDetails } from '@/lib/adminHub/currentLogo';
import { emitHubDataChanged } from '@/lib/adminHub/liveState';
import { refreshHubState } from '@/lib/adminHub/hubStore';
import { showHubToast } from '@/lib/adminHub/hubToast';
import { HUB_SAVE_FAILED, HUB_SAVED, HUB_SAVING } from '@/lib/freePreview/hubCopy';

type SaveKind = 'idle' | 'saving' | 'saved' | 'error' | 'sent';
type SliderKind = 'depth' | 'intensity';

type BrandColoursResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  submittedAt?: string;
  colours?: {
    brandPrimaryColour?: string | null;
    brandSecondaryColour?: string | null;
    brandColoursSentAt?: string | null;
    brandLocked?: boolean;
  };
};

/** Hue is kept per role when a colour gets close to grey, so the sliders never drift to another hue. */
const HUE_LOCK_MIN_C = 0.02;

function brandLockedSubmittedAt(status: number, body: BrandColoursResponse): string | null {
  if (status !== 409 || body.code !== 'BRAND_LOCKED') return null;
  return typeof body.submittedAt === 'string' && body.submittedAt ? body.submittedAt : null;
}

function hasEyedropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window;
}

function serviceRows(ctx: AdminHubAppBodyProps['ctx']): Array<{ name: string }> {
  const services = ctx.reviewShop?.services ?? [];
  return services.slice(0, 2).map((row) => ({ name: row.name }));
}

function storedHex(value: string | null | undefined): string {
  return parseCssColour(value)?.hex ?? '';
}

function scheduleFrame(callback: () => void): void {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 0);
  }
}

/** What "Save draft" writes; also the dirty check against the last saved version. */
function draftKey(colours: ColourSnapshot, swatches: ExtractedSwatch[], paletteLogoId: string | null): string {
  return JSON.stringify([colours.main, colours.accent, colours.tone, colours.source, swatches.map((row) => row.hex), paletteLogoId]);
}

function draftPayload(
  colours: ColourSnapshot,
  swatches: ExtractedSwatch[],
  paletteLogoId: string | null,
  send: boolean,
  source: BrandColoursSource = colours.source,
) {
  return {
    brandPrimaryColour: colours.main || null,
    brandSecondaryColour: colours.accent || null,
    brandBackgroundTone: colours.tone,
    brandColoursSource: source,
    brandPaletteExtracted: swatches.slice(0, MAX_PALETTE).map((row) => ({ hex: row.hex, share: row.share })),
    brandPaletteLogoAssetId: paletteLogoId,
    send,
  };
}

export default function ColoursApp({ ctx }: AdminHubAppBodyProps) {
  const logo = currentHubLogo(ctx.assets, currentHubLogoOptionsFromDetails(ctx.details));
  const logoUrl = logo ? logoDisplayUrl(ctx.apiBase, logo) : null;
  const logoId = logo?.id ?? null;
  const [locked, setLocked] = useState(() => Boolean(ctx.details.brandLocked || ctx.details.brandColoursSentAt));
  const [submittedAt, setSubmittedAt] = useState<string | null>(ctx.details.brandColoursSentAt ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSource, setConfirmSource] = useState<BrandColoursSource | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const canEdit = ctx.canEditDetails && !locked;

  const savedPalette = useMemo(
    () =>
      (ctx.details.brandPaletteExtracted ?? [])
        .map((row) => swatchFromHex(row.hex, row.share))
        .filter((row): row is ExtractedSwatch => Boolean(row)),
    // Seeded once per open: the app is never re-fed while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialColours: ColourSnapshot = {
    main: storedHex(ctx.details.brandPrimaryColour),
    accent: storedHex(ctx.details.brandSecondaryColour),
    tone: ctx.details.brandBackgroundTone ?? 'DARK',
    source: ctx.details.brandColoursSource ?? 'LOGO',
  };
  const initialPaletteLogoId = ctx.details.brandPaletteLogoAssetId ?? null;

  const [undo, setUndo] = useState<UndoState>({ current: initialColours, previous: null });
  const colours = undo.current;
  const { main: mainHex, accent: accentHex, tone, source } = colours;
  const [swatches, setSwatches] = useState<ExtractedSwatch[]>(() =>
    mergePalette({ logo: [], saved: savedPalette, keep: [initialColours.main, initialColours.accent] }),
  );
  const [paletteLogoId, setPaletteLogoId] = useState<string | null>(initialPaletteLogoId);
  // Logo clusters for "Reset to logo": saved rows with a share came from the logo the palette was extracted from.
  const [logoClusters, setLogoClusters] = useState<ExtractedSwatch[] | null>(() => {
    if (!savedPalette.length || !logoId || initialPaletteLogoId !== logoId) return null;
    const rows = savedPalette.filter((row) => row.share > 0);
    return rows.length ? rows : null;
  });
  const [savedKey, setSavedKey] = useState(() => draftKey(initialColours, swatches, initialPaletteLogoId));
  // First open with a logo and no saved palette: find colours. Afterwards only on "Find colours again" / retry.
  const [extractRun, setExtractRun] = useState(() => (!locked && logoUrl && !savedPalette.length ? 1 : 0));
  const [extracting, setExtracting] = useState(extractRun > 0);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [role, setRole] = useState<ColourRole>('main');
  const [hexOpen, setHexOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState('');
  const [hexSubmitted, setHexSubmitted] = useState(false);
  const [sameHex, setSameHex] = useState(false);
  const [save, setSave] = useState<SaveKind>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const touched = useRef(false);
  const hexButtonRef = useRef<HTMLButtonElement>(null);
  const hexInputRef = useRef<HTMLInputElement>(null);
  const hueLock = useRef<Record<ColourRole, number | null>>({ main: null, accent: null });
  const sliderStart = useRef<ColourSnapshot | null>(null);
  const sliderPending = useRef<{ kind: SliderKind; value: number; role: ColourRole } | null>(null);
  const sliderFrame = useRef(false);

  const key = draftKey(colours, swatches, paletteLogoId);
  const dirty = key !== savedKey;
  const latest = useRef({ colours, swatches, paletteLogoId, key, dirty, canEdit, save });
  latest.current = { colours, swatches, paletteLogoId, key, dirty, canEdit, save };

  useEffect(() => {
    for (const id of ['main', 'accent'] as const) {
      const lch = colours[id] ? hexToClampedOklch(colours[id]) : null;
      if (lch && lch.C >= HUE_LOCK_MIN_C) hueLock.current[id] = lch.h;
    }
  }, [colours]);

  useEffect(() => {
    if (!extractRun || !logoUrl) {
      setExtracting(false);
      return;
    }
    let cancelled = false;
    setExtracting(true);
    setExtractError(null);
    void extractFromLogoUrl(logoUrl)
      .then((rows) => {
        if (cancelled) return;
        const now = latest.current.colours;
        setSwatches((prev) => mergePalette({ logo: rows, saved: prev, keep: [now.main, now.accent] }));
        setLogoClusters(rows.length ? rows : null);
        setPaletteLogoId(logoId);
        if (!now.main && !now.accent && !touched.current) {
          const roles = assignDefaultRoles(rows);
          setUndo((u) => ({ ...u, current: { ...u.current, main: roles.main?.hex ?? '', accent: roles.accent?.hex ?? '', source: 'LOGO' } }));
        }
        setExtracting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setExtractError(ADMIN_HUB_COLOURS_EXTRACT_FAILED);
        setExtracting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [extractRun, logoId, logoUrl]);

  // Closing with unsaved edits keeps them as a draft (never sends).
  useEffect(
    () => () => {
      const state = latest.current;
      if (!touched.current || !state.dirty || !state.canEdit || state.save === 'saving') return;
      void fetch(`${ctx.apiBase}/brand-colours`, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPayload(state.colours, state.swatches, state.paletteLogoId, false)),
      })
        .then(async (response) => {
          const body = (await response.json()) as BrandColoursResponse;
          if (brandLockedSubmittedAt(response.status, body)) {
            emitHubDataChanged('colours-sent');
            void refreshHubState();
            return;
          }
          if (!response.ok || !body.ok) throw new Error(body.error || HUB_SAVE_FAILED);
          emitHubDataChanged('colours-saved');
          // The app has closed: refresh now so the Overview tile shows the draft.
          void refreshHubState();
          showHubToast(ADMIN_HUB_COLOURS_DRAFT_TOAST);
        })
        .catch(() => showHubToast(ADMIN_HUB_COLOURS_DRAFT_TOAST_FAILED));
    },
    [ctx.apiBase],
  );

  const selectedHex = role === 'main' ? mainHex : accentHex;
  const selected = selectedHex ? hexToClampedOklch(selectedHex) : null;
  const selectedHue = selected
    ? selected.C < HUE_LOCK_MIN_C && hueLock.current[role] !== null
      ? hueLock.current[role]!
      : selected.h
    : 0;
  const contrast = evaluateContrast({ mainHex: mainHex || null, accentHex: accentHex || null, tone });
  const bw = Boolean(logoClusters && assignDefaultRoles(logoClusters).blackAndWhite && !mainHex);
  const picks = selectedHex ? lightnessSteps(selectedHex) : [];
  const depthPct = selected ? Math.round(sliderDepth(selected.L) * 100) : 50;
  const intensityPct = selected ? Math.round(relativeChroma({ ...selected, h: selectedHue }) * 100) : 0;
  const depthStops = selectedHex ? depthGradient(selectedHex) : null;
  const intensityStops = selectedHex ? intensityGradient(selectedHex) : null;
  const services = serviceRows(ctx);
  const shopLabel = ctx.shopName.trim() || 'Your shop';
  const eyedropper = hasEyedropper();
  const newLogo = Boolean(!locked && logoId && swatches.length && paletteLogoId !== logoId && !extracting && !extractRun);

  /** One undoable change. Main and Accent can never share a hex. */
  const apply = useCallback((next: ColourSnapshot, note: 'same-hex' | null = null) => {
    setSameHex(note === 'same-hex');
    if (note) return;
    touched.current = true;
    setUndo((u) => commitEdit(u, next));
  }, []);

  const applyRoleHex = (target: ColourRole, hex: string, nextSource: BrandColoursSource = source): boolean => {
    const result = setRoleColour(colours, target, hex, nextSource);
    apply(result.next, result.note);
    return !result.note;
  };

  const onSwatch = (swatch: ExtractedSwatch) => {
    if (!canEdit) return;
    applyRoleHex(role, swatch.hex, 'LOGO');
  };

  const resetToLogo = () => {
    if (!logoClusters || !canEdit) return;
    const roles = assignDefaultRoles(logoClusters);
    apply({ ...colours, main: roles.main?.hex ?? '', accent: roles.accent?.hex ?? '', source: 'LOGO' });
  };

  const onUndo = () => {
    setSameHex(false);
    touched.current = true;
    setUndo(undoEdit);
  };

  const onSwap = () => apply(swapRoles(colours));
  const onNoAccent = () => {
    apply(clearAccent(colours));
    setRole('main');
  };

  const onFix = (target: ColourRole, hex: string) => applyRoleHex(target, hex);

  const findAgain = () => {
    touched.current = true;
    setExtractRun((n) => n + 1);
  };

  // Sliders: OKLCH with hue locked; intensity is relative to the most vivid in-gamut chroma; rAF-throttled.
  const flushSlider = () => {
    sliderFrame.current = false;
    const pending = sliderPending.current;
    sliderPending.current = null;
    if (!pending) return;
    const state = latest.current.colours;
    const hex = state[pending.role];
    const base = hex ? hexToClampedOklch(hex) : null;
    if (!base) return;
    const h = base.C < HUE_LOCK_MIN_C && hueLock.current[pending.role] !== null ? hueLock.current[pending.role]! : base.h;
    let L = base.L;
    let C: number;
    if (pending.kind === 'depth') {
      const intensity = relativeChroma({ ...base, h });
      L = lightnessFromDepth(pending.value / 100);
      C = chromaFromRelative(L, h, intensity);
    } else {
      C = chromaFromRelative(L, h, pending.value / 100);
    }
    const result = setRoleColour(state, pending.role, oklchToHex({ L, C, h }));
    setSameHex(result.note === 'same-hex');
    if (result.note) return;
    touched.current = true;
    // Undo is committed once, when the drag / key press ends.
    setUndo((u) => ({ ...u, current: result.next }));
  };

  const onSlider = (kind: SliderKind, value: number) => {
    if (!canEdit || !selectedHex) return;
    if (!sliderStart.current) sliderStart.current = colours;
    sliderPending.current = { kind, value: Math.max(0, Math.min(100, value)), role };
    if (sliderFrame.current) return;
    sliderFrame.current = true;
    scheduleFrame(flushSlider);
  };

  const endSlider = () => {
    const start = sliderStart.current;
    if (!start) return;
    sliderStart.current = null;
    scheduleFrame(() => setUndo((u) => commitEdit({ current: u.current, previous: u.previous }, u.current, start)));
  };

  const onSliderKey = (kind: SliderKind, value: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      onSlider(kind, value + (event.key === 'PageUp' ? 10 : -10));
    }
  };

  // Hex box: prefilled with the selected role, validated while typing, Enter applies, Esc closes.
  const hexCheck = parseHexInput(hexDraft, hexSubmitted);
  const hexError = hexCheck.ok
    ? null
    : hexCheck.reason === 'chars'
      ? ADMIN_HUB_COLOURS_HEX_ERROR_CHARS
      : hexCheck.reason === 'length' || (hexSubmitted && hexCheck.reason === 'empty')
        ? ADMIN_HUB_COLOURS_HEX_ERROR_LENGTH
        : null;

  const openHex = () => {
    if (hexOpen) {
      closeHex();
      return;
    }
    setHexDraft(selectedHex || '');
    setHexSubmitted(false);
    setHexOpen(true);
  };

  const closeHex = () => {
    setHexOpen(false);
    setHexSubmitted(false);
    hexButtonRef.current?.focus();
  };

  useEffect(() => {
    if (hexOpen) hexInputRef.current?.select();
  }, [hexOpen]);

  const onHexSubmit = () => {
    setHexSubmitted(true);
    const parsed = parseHexInput(hexDraft, true);
    if (!parsed.ok) return;
    if (!applyRoleHex(role, parsed.hex, 'MANUAL')) return;
    setSwatches((rows) => addToPalette(rows, parsed.hex, [mainHex, accentHex, parsed.hex]));
    closeHex();
  };

  const pickFromScreen = async () => {
    const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Ctor) return;
    try {
      const result = await new Ctor().open();
      const hex = normaliseHexColour(result.sRGBHex);
      if (hex && applyRoleHex(role, hex, 'MANUAL')) {
        setSwatches((rows) => addToPalette(rows, hex, [mainHex, accentHex, hex]));
      }
    } catch {
      /* cancelled */
    }
  };

  const applyLocked = useCallback((at: string) => {
    setLocked(true);
    setSubmittedAt(at);
    setConfirmOpen(false);
    setConfirmError(null);
    setSave('sent');
  }, []);

  const refreshLockedState = useCallback(
    async (fallbackAt: string) => {
      try {
        const response = await fetch(`${ctx.apiBase}/details`);
        const body = (await response.json()) as {
          ok?: boolean;
          details?: {
            brandPrimaryColour?: string | null;
            brandSecondaryColour?: string | null;
            brandColoursSentAt?: string | null;
          };
        };
        const main = storedHex(body.details?.brandPrimaryColour);
        const accent = storedHex(body.details?.brandSecondaryColour);
        if (main || accent) {
          setUndo((u) => ({ current: { ...u.current, main: main || u.current.main, accent: accent || u.current.accent }, previous: null }));
        }
        applyLocked(body.details?.brandColoursSentAt ?? fallbackAt);
      } catch {
        applyLocked(fallbackAt);
      }
    },
    [applyLocked, ctx.apiBase],
  );

  const persist = useCallback(
    async (send: boolean, nextSource?: BrandColoursSource) => {
      const state = latest.current;
      if (!ctx.canEditDetails || locked) return;
      const sentSource = nextSource ?? state.colours.source;
      setSave('saving');
      setSaveError(null);
      if (send) setConfirmError(null);
      try {
        const response = await fetch(`${ctx.apiBase}/brand-colours`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayload(state.colours, state.swatches, state.paletteLogoId, send, sentSource)),
        });
        const body = (await response.json()) as BrandColoursResponse;
        const lockedAt = brandLockedSubmittedAt(response.status, body);
        if (lockedAt) {
          await refreshLockedState(lockedAt);
          emitHubDataChanged('colours-sent');
          return;
        }
        if (!response.ok || !body.ok) throw new Error(body.error || HUB_SAVE_FAILED);
        if (send) {
          setUndo((u) => ({ current: { ...u.current, source: sentSource }, previous: null }));
          applyLocked(body.colours?.brandColoursSentAt ?? new Date().toISOString());
          emitHubDataChanged('colours-sent');
        } else {
          setSavedKey(state.key);
          setSave('saved');
          emitHubDataChanged('colours-saved');
        }
      } catch (err) {
        // The owner's edits stay on screen; only the error is shown.
        setSave('error');
        if (send) setConfirmError(err instanceof Error ? err.message : HUB_SAVE_FAILED);
        else setSaveError(ADMIN_HUB_COLOURS_SAVE_FAILED);
      }
    },
    [applyLocked, ctx.apiBase, ctx.canEditDetails, locked, refreshLockedState],
  );

  const openConfirm = useCallback(
    (nextSource: BrandColoursSource) => {
      if (!ctx.canEditDetails || locked) return;
      setConfirmSource(nextSource);
      setConfirmError(null);
      setConfirmOpen(true);
    },
    [ctx.canEditDetails, locked],
  );

  const headerAction = useMemo(
    () =>
      logoClusters && !locked ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={resetToLogo} disabled={!canEdit}>
          <RotateCcw width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
          {ADMIN_HUB_COLOURS_RESET}
        </button>
      ) : null,
    // resetToLogo reads the current colours; re-create when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, locked, logoClusters, colours],
  );

  const saveLabel = save === 'saving' && !confirmOpen ? HUB_SAVING : save === 'saved' && !dirty ? HUB_SAVED : ADMIN_HUB_COLOURS_SAVE;

  const footer = useMemo(() => {
    if (locked && submittedAt) {
      const date = formatBrandSubmittedDate(submittedAt);
      return (
        <p className="admin-hub-colours__locked" role="status">
          {ADMIN_HUB_COLOURS_LOCKED_NOTICE(date)} <a href={ADMIN_HUB_LINKS.messages}>{ADMIN_HUB_COLOURS_MESSAGE_US}</a>.
        </p>
      );
    }
    return (
      <>
        {saveError ? (
          <p className="admin-hub-colours__error admin-hub-colours__save-error" role="alert">
            {saveError}
          </p>
        ) : null}
        <p className="admin-hub-colours__choose">
          {ADMIN_HUB_COLOURS_CHOOSE_PREFIX}{' '}
          <button
            type="button"
            className="btn btn--link"
            disabled={!canEdit || save === 'saving'}
            onClick={() => openConfirm('KERSIVO_CHOOSES')}
          >
            {ADMIN_HUB_COLOURS_CHOOSE_LINK}
          </button>{' '}
          {ADMIN_HUB_COLOURS_CHOOSE_SUFFIX}
        </p>
        <button
          type="button"
          className="btn btn--outline"
          disabled={!canEdit || save === 'saving'}
          onClick={() => void persist(false)}
        >
          {saveLabel}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canEdit || save === 'saving'}
          onClick={() => openConfirm(source)}
        >
          <Send width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
          {ADMIN_HUB_COLOURS_SEND}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm admin-hub-colours__choose-mobile"
          disabled={!canEdit || save === 'saving'}
          onClick={() => openConfirm('KERSIVO_CHOOSES')}
        >
          {ADMIN_HUB_COLOURS_CHOOSE_SHORT}
        </button>
      </>
    );
  }, [canEdit, locked, openConfirm, persist, save, saveError, saveLabel, source, submittedAt]);

  useAppChrome({ headerAction, footer });

  if (locked) {
    return (
      <div className="admin-hub-colours" data-testid="admin-hub-colours" data-locked="true">
        <ColoursLogoPreview logoUrl={logoUrl} canUpload={false} />
        <SentSummary
          logoUrl={logoUrl}
          mainHex={mainHex}
          accentHex={accentHex}
          swatches={swatches}
          tone={tone}
          source={source}
          submittedAt={submittedAt}
        />
      </div>
    );
  }

  return (
    <div className="admin-hub-colours" data-testid="admin-hub-colours">
      <ColoursLogoPreview logoUrl={logoUrl} canUpload={ctx.canUpload} />

      <div className="admin-hub-colours__preview-first">
        <LivePreview shop={shopLabel} mainHex={mainHex} accentHex={accentHex} tone={tone} services={services} compact />
      </div>

      <div className="admin-hub-cp">
        <section className="admin-hub-cp__panel admin-hub-colours__found">
          <p className="admin-hub-cp__label admin-hub-colours__logo-heading">
            <ImagePlus width={12} height={12} strokeWidth={1.8} aria-hidden="true" />
            {ADMIN_HUB_COLOURS_YOUR_LOGO}
          </p>
          {logoUrl ? (
            <div className="admin-hub-logo-pair">
              <div className="admin-hub-logo-pair__dark" style={{ background: siteBackgroundHex('DARK', mainHex || null) }}>
                <img src={logoUrl} alt="" />
              </div>
              <div className="admin-hub-logo-pair__light" style={{ background: siteBackgroundHex('LIGHT', mainHex || null) }}>
                <img src={logoUrl} alt="" />
              </div>
            </div>
          ) : (
            <ColoursLogoPreview logoUrl={null} canUpload={ctx.canUpload} inPanel />
          )}
          <p className="admin-hub-cp__label">
            <Sparkles width={12} height={12} strokeWidth={1.8} aria-hidden="true" />
            {ADMIN_HUB_COLOURS_FOUND_IN}
          </p>
          {extracting && !swatches.length ? <div className="hub-skel hub-skel--card" aria-busy="true" /> : null}
          {extractError ? <AppStatus state="error" error={extractError} onRetry={findAgain} /> : null}
          {newLogo ? (
            <div className="admin-hub-colours__again" data-testid="admin-hub-colours-new-logo">
              {paletteLogoId ? <p className="admin-hub-colours__hint">{ADMIN_HUB_COLOURS_NEW_LOGO}</p> : null}
              <button type="button" className="btn btn--outline btn--sm" onClick={findAgain} disabled={!canEdit}>
                <Sparkles width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
                {ADMIN_HUB_COLOURS_FIND_AGAIN}
              </button>
            </div>
          ) : null}
          {!extracting && !swatches.length && !logoUrl ? <p className="admin-hub-colours__hint">{ADMIN_HUB_COLOURS_EMPTY}</p> : null}
          {bw ? <p className="admin-hub-colours__hint">{ADMIN_HUB_COLOURS_BW}</p> : null}
          <div className="admin-hub-extract" aria-busy={extracting || undefined}>
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
          <div className="admin-hub-swatch-row" role="group" aria-label={ADMIN_HUB_COLOURS_FOUND_IN}>
            {swatches.map((swatch) => {
              const label =
                swatch.hex === mainHex ? ADMIN_HUB_COLOURS_MAIN : swatch.hex === accentHex ? ADMIN_HUB_COLOURS_ACCENT : swatch.name;
              return (
                <button
                  key={`m-${swatch.hex}`}
                  type="button"
                  className={`admin-hub-swatch-row__item${swatch.hex === mainHex || swatch.hex === accentHex ? ' is-on' : ''}`}
                  aria-label={label !== swatch.name ? `${label}, ${swatch.name} ${swatch.hex}` : `${swatch.name} ${swatch.hex}`}
                  onClick={() => onSwatch(swatch)}
                  disabled={!canEdit}
                >
                  <span style={{ background: swatch.hex }} />
                  <small aria-hidden="true">{label}</small>
                </button>
              );
            })}
          </div>
          <div className="admin-hub-colours__tools">
            {eyedropper ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void pickFromScreen()} disabled={!canEdit}>
                <Pipette width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
                {ADMIN_HUB_COLOURS_PICK_SCREEN}
              </button>
            ) : null}
            <button
              ref={hexButtonRef}
              type="button"
              className="btn btn--outline btn--sm"
              onClick={openHex}
              disabled={!canEdit}
              aria-expanded={hexOpen}
              aria-controls="admin-hub-colours-hex"
            >
              {ADMIN_HUB_COLOURS_HEX}
            </button>
          </div>
          {hexOpen ? (
            <div className="admin-hub-colours__hex" id="admin-hub-colours-hex">
              <label>
                {ADMIN_HUB_COLOURS_HEX_LABEL}
                <input
                  ref={hexInputRef}
                  value={hexDraft}
                  onChange={(event) => {
                    setHexDraft(event.target.value);
                    setHexSubmitted(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onHexSubmit();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      closeHex();
                    }
                  }}
                  placeholder="#1F6F6B"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={9}
                  aria-invalid={hexError ? true : undefined}
                  aria-describedby={hexError ? 'admin-hub-colours-hex-error' : undefined}
                  disabled={!canEdit}
                />
              </label>
              <button type="button" className="btn btn--outline btn--sm" onClick={onHexSubmit} disabled={!canEdit}>
                {ADMIN_HUB_COLOURS_HEX_USE}
              </button>
              {hexError ? (
                <p className="admin-hub-colours__field-error" id="admin-hub-colours-hex-error">
                  {hexError}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="admin-hub-colours__edit">
          <div className="admin-hub-roles" role="group" aria-label={ADMIN_HUB_COLOURS_ROLE_GROUP}>
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
                  disabled={!canEdit}
                >
                  <span className={`admin-hub-role__sw${hex ? '' : ' is-empty'}`} style={{ background: hex || undefined }} />
                  <span>
                    <span className="admin-hub-role__k">{id === 'main' ? ADMIN_HUB_COLOURS_MAIN : ADMIN_HUB_COLOURS_ACCENT}</span>
                    <span className="admin-hub-role__v">{named}</span>
                  </span>
                  <span className="admin-hub-role__hex">{hex || '—'}</span>
                </button>
              );
            })}
          </div>
          <div className="admin-hub-seg" role="group" aria-label={ADMIN_HUB_COLOURS_ROLE_GROUP}>
            {(['main', 'accent'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={role === id ? 'is-on' : ''}
                onClick={() => setRole(id)}
                aria-pressed={role === id}
                disabled={!canEdit}
              >
                {id === 'main' ? ADMIN_HUB_COLOURS_MAIN_SEG : ADMIN_HUB_COLOURS_ACCENT}
              </button>
            ))}
          </div>
          <div className="admin-hub-role-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onSwap}
              disabled={!canEdit || (!mainHex && !accentHex)}
              aria-label={ADMIN_HUB_COLOURS_SWAP_LABEL}
            >
              <ArrowLeftRight width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
              {ADMIN_HUB_COLOURS_SWAP}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onNoAccent} disabled={!canEdit || !accentHex}>
              <X width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
              {ADMIN_HUB_COLOURS_NO_ACCENT}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onUndo} disabled={!canEdit || !undo.previous}>
              <Undo2 width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
              {ADMIN_HUB_COLOURS_UNDO}
            </button>
          </div>
          <p className="admin-hub-colours__note" aria-live="polite" data-testid="admin-hub-colours-note">
            {sameHex ? ADMIN_HUB_COLOURS_SAME_HEX : ''}
          </p>
          <div className="admin-hub-cp__panel admin-hub-tuner">
            <p className="admin-hub-cp__label">
              {role === 'main' ? ADMIN_HUB_COLOURS_FINE_TUNE_MAIN : ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT}
            </p>
            <div className="admin-hub-slider">
              <span className="admin-hub-slider__top" aria-hidden="true">
                <span>{ADMIN_HUB_COLOURS_LIGHTER}</span>
                <b>{ADMIN_HUB_COLOURS_DEPTH}</b>
                <span>{ADMIN_HUB_COLOURS_DEEPER}</span>
              </span>
              <span
                className="admin-hub-track"
                style={{
                  ['--admin-hub-thumb' as string]: selectedHex || 'var(--admin-hub-muted-2)',
                  background: depthStops ? `linear-gradient(90deg, ${depthStops.lighter}, ${depthStops.mid}, ${depthStops.deeper})` : undefined,
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={depthPct}
                  aria-label={ADMIN_HUB_COLOURS_DEPTH}
                  aria-valuetext={ADMIN_HUB_COLOURS_SLIDER_WORDS.depth(depthPct)}
                  disabled={!canEdit || !selectedHex}
                  onChange={(event) => onSlider('depth', Number(event.target.value))}
                  onKeyDown={onSliderKey('depth', depthPct)}
                  onPointerUp={endSlider}
                  onKeyUp={endSlider}
                  onBlur={endSlider}
                />
              </span>
            </div>
            <div className="admin-hub-slider">
              <span className="admin-hub-slider__top" aria-hidden="true">
                <span>{ADMIN_HUB_COLOURS_MUTED}</span>
                <b>{ADMIN_HUB_COLOURS_INTENSITY}</b>
                <span>{ADMIN_HUB_COLOURS_VIVID}</span>
              </span>
              <span
                className="admin-hub-track"
                style={{
                  ['--admin-hub-thumb' as string]: selectedHex || 'var(--admin-hub-muted-2)',
                  background: intensityStops
                    ? `linear-gradient(90deg, ${intensityStops.muted}, ${intensityStops.mid}, ${intensityStops.vivid})`
                    : undefined,
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={intensityPct}
                  aria-label={ADMIN_HUB_COLOURS_INTENSITY}
                  aria-valuetext={ADMIN_HUB_COLOURS_SLIDER_WORDS.intensity(intensityPct)}
                  disabled={!canEdit || !selectedHex}
                  onChange={(event) => onSlider('intensity', Number(event.target.value))}
                  onKeyDown={onSliderKey('intensity', intensityPct)}
                  onPointerUp={endSlider}
                  onKeyUp={endSlider}
                  onBlur={endSlider}
                />
              </span>
            </div>
            <div className="admin-hub-colours__quick">
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
                    aria-pressed={hex === selectedHex}
                    disabled={!canEdit}
                    onClick={() => applyRoleHex(role, hex)}
                  />
                ))}
              </div>
            </div>
            <div className="admin-hub-colours__tone">
              <div className="admin-hub-slider__top">
                <span id="admin-hub-colours-bg">{ADMIN_HUB_COLOURS_BG}</span>
              </div>
              <div className="admin-hub-tone" role="group" aria-labelledby="admin-hub-colours-bg">
                {(['DARK', 'LIGHT'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={tone === value ? 'is-on' : ''}
                    aria-pressed={tone === value}
                    onClick={() => apply({ ...colours, tone: value })}
                    disabled={!canEdit}
                  >
                    <i style={{ background: siteBackgroundHex(value, mainHex || null) }} />
                    {value === 'DARK' ? ADMIN_HUB_COLOURS_DARK : ADMIN_HUB_COLOURS_LIGHT}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="admin-hub-colours__looks">
          <p className="admin-hub-cp__label admin-hub-colours__looks-label">{ADMIN_HUB_COLOURS_LOOKS}</p>
          <div className="admin-hub-colours__looks-preview">
            <LivePreview shop={shopLabel} mainHex={mainHex} accentHex={accentHex} tone={tone} services={services} />
          </div>
          <ContrastBlock contrast={contrast} canEdit={canEdit} onFix={onFix} />
          <p className="admin-hub-colours__guide">{ADMIN_HUB_COLOURS_GUIDE}</p>
        </section>
      </div>
      {confirmOpen ? (
        <AdminHubConfirmDialog
          title={ADMIN_HUB_COLOURS_CONFIRM_TITLE}
          body={ADMIN_HUB_COLOURS_CONFIRM_BODY}
          primaryLabel={ADMIN_HUB_COLOURS_CONFIRM_YES}
          secondaryLabel={ADMIN_HUB_COLOURS_CONFIRM_BACK}
          busy={save === 'saving'}
          busyLabel={ADMIN_HUB_COLOURS_SENDING}
          error={confirmError}
          onConfirm={() => void persist(true, confirmSource ?? source)}
          onClose={() => {
            if (save === 'saving') return;
            setConfirmOpen(false);
            setConfirmError(null);
          }}
          testId="admin-hub-colours-confirm"
        >
          <ConfirmSummary logoUrl={logoUrl} mainHex={mainHex} accentHex={accentHex} swatches={swatches} />
        </AdminHubConfirmDialog>
      ) : null}
    </div>
  );
}

function ConfirmSummary(props: {
  logoUrl: string | null;
  mainHex: string;
  accentHex: string;
  swatches: ExtractedSwatch[];
}) {
  const extras = props.swatches.filter((row) => row.hex !== props.mainHex && row.hex !== props.accentHex);
  return (
    <div className="admin-hub-confirm__summary">
      <div className="admin-hub-confirm__logo">
        {props.logoUrl ? <img src={props.logoUrl} alt="" /> : <span>{ADMIN_HUB_COLOURS_NO_LOGO}</span>}
      </div>
      <ul className="admin-hub-confirm__swatches">
        {props.mainHex ? (
          <li>
            <i style={{ background: props.mainHex }} aria-hidden="true" />
            <span>{ADMIN_HUB_COLOURS_MAIN}</span>
            <code>{props.mainHex}</code>
          </li>
        ) : null}
        {props.accentHex ? (
          <li>
            <i style={{ background: props.accentHex }} aria-hidden="true" />
            <span>{ADMIN_HUB_COLOURS_ACCENT}</span>
            <code>{props.accentHex}</code>
          </li>
        ) : null}
        {extras.map((row) => (
          <li key={row.hex}>
            <i style={{ background: row.hex }} aria-hidden="true" />
            <span>{row.name}</span>
            <code>{row.hex}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SentSummary(props: {
  logoUrl: string | null;
  mainHex: string;
  accentHex: string;
  swatches: ExtractedSwatch[];
  tone: BrandBackgroundTone;
  source: BrandColoursSource;
  submittedAt: string | null;
}) {
  const extras = props.swatches.filter((row) => row.hex !== props.mainHex && row.hex !== props.accentHex);
  const rows = [
    ...(props.mainHex ? [{ label: ADMIN_HUB_COLOURS_MAIN, hex: props.mainHex }] : []),
    ...(props.accentHex ? [{ label: ADMIN_HUB_COLOURS_ACCENT, hex: props.accentHex }] : []),
  ];
  const sourceLabel =
    props.source === 'KERSIVO_CHOOSES'
      ? ADMIN_HUB_COLOURS_SOURCE_KERSIVO
      : props.source === 'MANUAL'
        ? ADMIN_HUB_COLOURS_SOURCE_MANUAL
        : ADMIN_HUB_COLOURS_SOURCE_LOGO;
  return (
    <section className="admin-hub-colours-sent" data-testid="admin-hub-colours-sent">
      {props.logoUrl ? (
        <div className="admin-hub-logo-pair admin-hub-colours-sent__logos">
          <div className="admin-hub-logo-pair__dark" style={{ background: siteBackgroundHex('DARK', props.mainHex || null) }}>
            <img src={props.logoUrl} alt="" />
          </div>
          <div className="admin-hub-logo-pair__light" style={{ background: siteBackgroundHex('LIGHT', props.mainHex || null) }}>
            <img src={props.logoUrl} alt="" />
          </div>
        </div>
      ) : null}
      <dl className="admin-hub-colours-sent__list">
        {rows.map((row) => (
          <HexRow key={row.label} label={row.label} hex={row.hex} />
        ))}
        {extras.length ? (
          <div className="admin-hub-colours-sent__row admin-hub-colours-sent__row--palette">
            <dt>{ADMIN_HUB_COLOURS_PALETTE}</dt>
            <dd>
              <ul className="admin-hub-colours-sent__palette">
                {extras.map((row) => (
                  <li key={row.hex}>
                    <i style={{ background: row.hex }} aria-hidden="true" />
                    <span>{row.name}</span>
                    <code>{row.hex}</code>
                    <CopyHexButton hex={row.hex} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div className="admin-hub-colours-sent__row">
          <dt>{ADMIN_HUB_COLOURS_BG}</dt>
          <dd>
            <i style={{ background: siteBackgroundHex(props.tone, props.mainHex || null) }} aria-hidden="true" />
            {props.tone === 'LIGHT' ? ADMIN_HUB_COLOURS_LIGHT : ADMIN_HUB_COLOURS_DARK}
          </dd>
        </div>
        <div className="admin-hub-colours-sent__row">
          <dt>{ADMIN_HUB_COLOURS_SOURCE_LABEL}</dt>
          <dd>{sourceLabel}</dd>
        </div>
        {props.submittedAt ? (
          <div className="admin-hub-colours-sent__row">
            <dt>{ADMIN_HUB_COLOURS_SENT_ON}</dt>
            <dd>{formatBrandSubmittedDate(props.submittedAt)}</dd>
          </div>
        ) : null}
      </dl>
      <a className="btn btn--outline btn--sm admin-hub-colours-sent__message" href={ADMIN_HUB_LINKS.messages}>
        {ADMIN_HUB_COLOURS_MESSAGE_US}
      </a>
    </section>
  );
}

function HexRow(props: { label: string; hex: string }) {
  const lch = hexToClampedOklch(props.hex);
  return (
    <div className="admin-hub-colours-sent__row">
      <dt>{props.label}</dt>
      <dd>
        <i style={{ background: props.hex }} aria-hidden="true" />
        <span>{lch ? nameSwatch(lch) : props.hex}</span>
        <code>{props.hex}</code>
        <CopyHexButton hex={props.hex} />
      </dd>
    </div>
  );
}

function CopyHexButton(props: { hex: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(props.hex);
      setCopied(true);
    } catch {
      /* clipboard blocked: the hex stays visible to copy by hand */
    }
  };
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm admin-hub-copy-hex"
      onClick={() => void onCopy()}
      aria-label={ADMIN_HUB_COLOURS_COPY_HEX(props.hex)}
    >
      {copied ? (
        <Check width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Copy width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? ADMIN_HUB_COLOURS_COPIED : ADMIN_HUB_COLOURS_COPY}</span>
    </button>
  );
}

function ColoursLogoPreview(props: {
  logoUrl: string | null;
  canUpload: boolean;
  inPanel?: boolean;
}) {
  return (
    <div
      className={`admin-hub-colours__logo${props.inPanel ? ' admin-hub-colours__logo--in-panel' : ''}`}
      data-testid={props.inPanel ? 'admin-hub-colours-logo-panel' : 'admin-hub-colours-logo'}
    >
      {props.logoUrl ? (
        <div className="admin-hub-colours__logo-frame">
          <img src={props.logoUrl} alt="" />
        </div>
      ) : (
        <div className="admin-hub-colours__logo-empty">
          <p>{ADMIN_HUB_COLOURS_NO_LOGO}</p>
          {props.canUpload ? (
            <a className="btn btn--outline btn--sm" href={adminHubMaterialsHref('logo')}>
              {ADMIN_HUB_COLOURS_UPLOAD}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The one readability block: button text on accent, and Main on the website background. */
function ContrastBlock(props: {
  contrast: ContrastCheck;
  canEdit: boolean;
  onFix: (role: ColourRole, hex: string) => void;
}) {
  const lines = [
    props.contrast.button
      ? {
          id: 'button',
          role: 'accent' as const,
          label: ADMIN_HUB_COLOURS_CONTRAST_BUTTON,
          line: props.contrast.button,
          fix:
            props.contrast.button.fixLabel === 'lighter'
              ? ADMIN_HUB_COLOURS_MAKE_ACCENT_LIGHTER
              : ADMIN_HUB_COLOURS_MAKE_ACCENT_DEEPER,
        }
      : null,
    props.contrast.main
      ? {
          id: 'main',
          role: 'main' as const,
          label: ADMIN_HUB_COLOURS_CONTRAST_MAIN,
          line: props.contrast.main,
          fix:
            props.contrast.main.fixLabel === 'deeper' ? ADMIN_HUB_COLOURS_MAKE_MAIN_DEEPER : ADMIN_HUB_COLOURS_MAKE_MAIN_LIGHTER,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!lines.length) return null;
  return (
    <div className="admin-hub-contrast" data-testid="admin-hub-colours-contrast">
      <p className="admin-hub-cp__label">{ADMIN_HUB_COLOURS_READABILITY}</p>
      <ul>
        {lines.map((row) => (
          <li
            key={row.id}
            className={`admin-hub-check ${row.line.pass ? 'admin-hub-check--ok' : 'admin-hub-check--warn'}`}
            data-line={row.id}
            data-pass={row.line.pass ? 'true' : 'false'}
          >
            <span>
              {row.label} — {formatContrastRatio(row.line.ratio)} <span aria-hidden="true">{row.line.pass ? '✓' : '✗'}</span>
              <span className="admin-hub-sr-only">
                {' '}
                {row.line.pass ? ADMIN_HUB_COLOURS_CONTRAST_PASS : ADMIN_HUB_COLOURS_CONTRAST_LOW}
              </span>
            </span>
            {!row.line.pass && row.line.fixHex ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!props.canEdit}
                onClick={() => props.onFix(row.role, row.line.fixHex!)}
              >
                {row.fix}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Neutral greys when there is no Main yet — never a made-up brand colour. */
function neutralHeroHex(tone: BrandBackgroundTone): string {
  return oklchToHex({ L: tone === 'LIGHT' ? 0.88 : 0.3, C: 0, h: 0 });
}

function LivePreview(props: {
  shop: string;
  mainHex: string;
  accentHex: string;
  tone: BrandBackgroundTone;
  services: Array<{ name: string }>;
  compact?: boolean;
}) {
  const main = props.mainHex || null;
  const accent = props.accentHex || null;
  const background = siteBackgroundHex(props.tone, main);
  const text = siteTextHex(props.tone);
  const heroBg = main ?? neutralHeroHex(props.tone);
  const heroText = betterButtonText(heroBg);
  const hero = {
    background: accent ? `radial-gradient(90% 90% at 85% 0%, ${accent}59, transparent 55%), ${heroBg}` : heroBg,
    color: heroText,
  };
  // Book button: Accent; without one, the site background on the Main hero.
  const button = accent
    ? { background: accent, color: betterButtonText(accent) }
    : main
      ? { background, color: text }
      : { background: text, color: background };
  return (
    <div className="admin-hub-livep-wrap">
      {!main ? (
        <p className="admin-hub-colours__prompt" data-testid="admin-hub-colours-pick-main">
          {ADMIN_HUB_COLOURS_PICK_MAIN}
        </p>
      ) : null}
      <div
        className={`admin-hub-livep${props.compact ? ' admin-hub-livep--compact' : ''}`}
        aria-hidden="true"
        data-testid={props.compact ? 'admin-hub-colours-preview-compact' : 'admin-hub-colours-preview'}
      >
        <div className="admin-hub-livep__hero" style={hero}>
          {!props.compact ? (
            <div className="admin-hub-livep__nav">
              <span>{props.shop}</span>
              <span style={button}>Book</span>
            </div>
          ) : null}
          <div className="admin-hub-livep__h">{props.shop}</div>
          <div className="admin-hub-livep__btns">
            <span className="admin-hub-livep__book" style={button}>
              {ADMIN_HUB_COLOURS_BOOK}
            </span>
            {!props.compact ? (
              <span style={{ border: `1px solid ${heroText}66`, color: 'inherit' }}>{ADMIN_HUB_COLOURS_PRICES}</span>
            ) : null}
          </div>
        </div>
        {!props.compact ? (
          <div className="admin-hub-livep__body" style={{ background, color: text }}>
            {(props.services.length ? props.services : [{ name: 'Cut' }, { name: 'Beard' }]).map((row) => (
              <div key={row.name} className="admin-hub-livep__svc" style={{ borderBottomColor: `${text}1F` }}>
                <span>{row.name}</span>
                <b style={{ color: accent ?? main ?? text }}>·</b>
              </div>
            ))}
            <div className="admin-hub-livep__slots">
              <span
                className="admin-hub-livep__slot"
                style={main ? { background: main, color: betterButtonText(main), borderColor: main } : { borderColor: `${text}2E` }}
              >
                10:00
              </span>
              <span style={{ borderColor: `${text}2E` }}>10:30</span>
              <span style={{ borderColor: `${text}2E` }}>11:15</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
