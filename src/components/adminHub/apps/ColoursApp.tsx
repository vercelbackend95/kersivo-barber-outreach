import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  ImagePlus,
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
import { ColourPicker, type PickerPhase } from './colours/ColourPicker';
import { ReadabilityGuide } from './colours/ReadabilityGuide';
import {
  ADMIN_HUB_COLOURS_ACCENT,
  ADMIN_HUB_COLOURS_BG,
  ADMIN_HUB_COLOURS_BW,
  ADMIN_HUB_COLOURS_CHOOSE_LINK,
  ADMIN_HUB_COLOURS_CHOOSE_PREFIX,
  ADMIN_HUB_COLOURS_CHOOSE_SHORT,
  ADMIN_HUB_COLOURS_CHOOSE_SUFFIX,
  ADMIN_HUB_COLOURS_CONFIRM_BACK,
  ADMIN_HUB_COLOURS_CONFIRM_BODY,
  ADMIN_HUB_COLOURS_CONFIRM_TITLE,
  ADMIN_HUB_COLOURS_CONFIRM_YES,
  ADMIN_HUB_COLOURS_COPIED,
  ADMIN_HUB_COLOURS_COPY,
  ADMIN_HUB_COLOURS_COPY_HEX,
  ADMIN_HUB_COLOURS_DARK,
  ADMIN_HUB_COLOURS_DRAFT_TOAST,
  ADMIN_HUB_COLOURS_DRAFT_TOAST_FAILED,
  ADMIN_HUB_COLOURS_EMPTY,
  ADMIN_HUB_COLOURS_EXTRACT_FAILED,
  ADMIN_HUB_COLOURS_EMPTY_ROLE,
  ADMIN_HUB_COLOURS_FIND_AGAIN,
  ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT,
  ADMIN_HUB_COLOURS_FINE_TUNE_MAIN,
  ADMIN_HUB_COLOURS_FOUND_IN,
  ADMIN_HUB_COLOURS_GUIDE_NOTE,
  ADMIN_HUB_COLOURS_LIGHT,
  ADMIN_HUB_COLOURS_LOCKED_NOTICE,
  ADMIN_HUB_COLOURS_LOOKS,
  ADMIN_HUB_COLOURS_MAIN,
  ADMIN_HUB_COLOURS_MESSAGE_US,
  ADMIN_HUB_COLOURS_NEW_LOGO,
  ADMIN_HUB_COLOURS_NO_ACCENT,
  ADMIN_HUB_COLOURS_NO_LOGO,
  ADMIN_HUB_COLOURS_PAIR_LABEL,
  ADMIN_HUB_COLOURS_PAIRS,
  ADMIN_HUB_COLOURS_PAIRS_HINT,
  ADMIN_HUB_COLOURS_PALETTE,
  ADMIN_HUB_COLOURS_PICK_MAIN,
  ADMIN_HUB_COLOURS_RESET,
  ADMIN_HUB_COLOURS_ROLE_GROUP,
  ADMIN_HUB_COLOURS_SAME_HEX,
  ADMIN_HUB_COLOURS_SAVE,
  ADMIN_HUB_COLOURS_SAVE_FAILED,
  ADMIN_HUB_COLOURS_SEND,
  ADMIN_HUB_COLOURS_SENDING,
  ADMIN_HUB_COLOURS_SENT_ON,
  ADMIN_HUB_COLOURS_SOURCE_KERSIVO,
  ADMIN_HUB_COLOURS_SOURCE_LABEL,
  ADMIN_HUB_COLOURS_SOURCE_LOGO,
  ADMIN_HUB_COLOURS_SOURCE_MANUAL,
  ADMIN_HUB_COLOURS_SUGGEST,
  ADMIN_HUB_COLOURS_SUGGEST_HINT,
  ADMIN_HUB_COLOURS_SWAP,
  ADMIN_HUB_COLOURS_SWAP_LABEL,
  ADMIN_HUB_COLOURS_UNDO,
  ADMIN_HUB_COLOURS_UPLOAD,
  ADMIN_HUB_COLOURS_VISION,
  ADMIN_HUB_COLOURS_VISION_CB,
  ADMIN_HUB_COLOURS_VISION_GREY,
  ADMIN_HUB_COLOURS_VISION_NORMAL,
  ADMIN_HUB_COLOURS_VISION_NOTE,
  ADMIN_HUB_COLOURS_YOUR_LOGO,
  formatBrandSubmittedDate,
} from '@/lib/adminHub/copy';
import { ADMIN_HUB_LINKS } from '@/lib/adminHub/links';
import { adminHubMaterialsHref } from '@/lib/adminHub/addMenu';
import {
  BARBERSHOP_PAIRS,
  PICKER_DEFAULT_HUE,
  PICKER_GREY_C,
  accentSuggestions,
  addToPalette,
  assignDefaultRoles,
  clearAccent,
  commitEdit,
  distinctRoleNames,
  hexToClampedOklch,
  mergePalette,
  MAX_PALETTE,
  normaliseHexColour,
  parseCssColour,
  readabilityReport,
  resetHistory,
  setRoleColour,
  siteBackgroundHex,
  swapRoles,
  swatchFromHex,
  undoEdit,
  visionMatrix,
  withHue,
  type BrandBackgroundTone,
  type BrandColoursSource,
  type ColourRole,
  type ColourSnapshot,
  type ExtractedSwatch,
  type UndoState,
} from '@/lib/adminHub/colour';
import { extractFromLogoUrl, logoDisplayUrl } from '@/lib/adminHub/colour/runExtract';
import { currentHubLogo, currentHubLogoOptionsFromDetails } from '@/lib/adminHub/currentLogo';
import { overviewImageSize } from '@/lib/adminHub/overviewTiles';
import { HubLogoMark } from '../HubLogoMark';
import { BrandSitePreview } from '../BrandSitePreview';
import { emitHubDataChanged } from '@/lib/adminHub/liveState';
import { refreshHubState } from '@/lib/adminHub/hubStore';
import { showHubToast } from '@/lib/adminHub/hubToast';
import { HUB_SAVE_FAILED, HUB_SAVED, HUB_SAVING } from '@/lib/freePreview/hubCopy';

type SaveKind = 'idle' | 'saving' | 'saved' | 'error' | 'sent';
type Vision = 'normal' | 'deuteranopia' | 'grey';

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

const VISION_FILTER_ID = 'admin-hub-vision-deutan';

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

/** The hue a role's colour sits on (null for greys and empty roles: they have no hue of their own). */
function ownHue(hex: string): number | null {
  const lch = hex ? hexToClampedOklch(hex) : null;
  return lch && lch.C >= PICKER_GREY_C ? lch.h : null;
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
  const logoSize = logo ? overviewImageSize(logo) : null;
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

  const [undo, setUndo] = useState<UndoState>(() => resetHistory(initialColours));
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
  // The hue each role's picker shows. Kept while a colour is grey or empty, so the area never jumps to red.
  const [hues, setHues] = useState<Record<ColourRole, number>>(() => ({
    main: ownHue(initialColours.main) ?? PICKER_DEFAULT_HUE,
    accent: ownHue(initialColours.accent) ?? ownHue(initialColours.main) ?? PICKER_DEFAULT_HUE,
  }));
  const [vision, setVision] = useState<Vision>('normal');
  const [sameHex, setSameHex] = useState(false);
  const [save, setSave] = useState<SaveKind>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const touched = useRef(false);
  const liveStart = useRef<ColourSnapshot | null>(null);
  const livePending = useRef<{ role: ColourRole; hex: string } | null>(null);
  const liveFrame = useRef(false);

  const key = draftKey(colours, swatches, paletteLogoId);
  const dirty = key !== savedKey;
  const latest = useRef({ colours, swatches, paletteLogoId, key, dirty, canEdit, save });
  latest.current = { colours, swatches, paletteLogoId, key, dirty, canEdit, save };

  // A role's picker follows its colour's hue whenever the colour has one.
  useEffect(() => {
    setHues((prev) => {
      const main = ownHue(colours.main);
      const accent = ownHue(colours.accent);
      const next = { main: main ?? prev.main, accent: accent ?? prev.accent };
      return Math.abs(next.main - prev.main) < 0.5 && Math.abs(next.accent - prev.accent) < 0.5 ? prev : next;
    });
  }, [colours.main, colours.accent]);

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
  const report = useMemo(
    () => readabilityReport({ mainHex: mainHex || null, accentHex: accentHex || null, tone }),
    [mainHex, accentHex, tone],
  );
  // Main / Accent never read the same for two different colours (e.g. "Dark copper" / "Copper").
  const roleNames = distinctRoleNames(mainHex || null, accentHex || null);
  const bw = Boolean(logoClusters && assignDefaultRoles(logoClusters).blackAndWhite && !mainHex);
  const suggestions = useMemo(
    () => (role === 'accent' && mainHex ? accentSuggestions({ mainHex, tone, exclude: [accentHex], limit: 5 }) : []),
    [role, mainHex, accentHex, tone],
  );
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

  const onUndo = useCallback(() => {
    setSameHex(false);
    touched.current = true;
    setUndo(undoEdit);
  }, []);

  const onSwap = () => apply(swapRoles(colours));
  const onNoAccent = () => {
    apply(clearAccent(colours));
    setRole('main');
  };

  const onFix = (target: ColourRole, hex: string) => applyRoleHex(target, hex);

  const onFixAll = () => {
    const fix = report.fixAll;
    if (!fix || !canEdit) return;
    apply({ ...colours, main: fix.main ?? colours.main, accent: fix.accent ?? colours.accent });
  };

  const onPair = (pair: (typeof BARBERSHOP_PAIRS)[number]) => {
    if (!canEdit) return;
    apply({ ...colours, main: pair.main, accent: pair.accent, tone: pair.tone, source: 'MANUAL' });
  };

  const findAgain = () => {
    touched.current = true;
    setExtractRun((n) => n + 1);
  };

  // Ctrl / Cmd + Z inside the app undoes the last colour change (not while typing in the hex box).
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (!target?.closest?.('[data-testid="admin-hub-colours"]')) return;
      event.preventDefault();
      onUndo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canEdit, onUndo]);

  /* Live edits (picker drag, hue drag, arrow keys): painted every frame, one undo step per gesture. */
  const flushLive = () => {
    liveFrame.current = false;
    const pending = livePending.current;
    livePending.current = null;
    if (!pending) return;
    const result = setRoleColour(latest.current.colours, pending.role, pending.hex, 'MANUAL');
    setSameHex(result.note === 'same-hex');
    if (result.note) return;
    touched.current = true;
    setUndo((u) => ({ ...u, current: result.next }));
  };

  const queueLive = (target: ColourRole, hex: string) => {
    livePending.current = { role: target, hex };
    if (liveFrame.current) return;
    liveFrame.current = true;
    scheduleFrame(flushLive);
  };

  const endLive = () => {
    const start = liveStart.current;
    if (!start) return;
    liveStart.current = null;
    // After the last queued frame lands, commit the whole gesture as one undo step.
    scheduleFrame(() => scheduleFrame(() => setUndo((u) => commitEdit(u, u.current, start))));
  };

  const onLive = (hex: string, phase: PickerPhase) => {
    if (!canEdit) return;
    if (phase === 'start' && !liveStart.current) liveStart.current = latest.current.colours;
    if (phase !== 'end' || hex) queueLive(role, hex);
    if (phase === 'end') endLive();
  };

  const onHue = (h: number, phase: PickerPhase) => {
    if (!canEdit) return;
    if (phase === 'start') {
      if (!liveStart.current) liveStart.current = latest.current.colours;
      return;
    }
    if (phase === 'end') {
      endLive();
      return;
    }
    setHues((prev) => ({ ...prev, [role]: h }));
    const current = latest.current.colours[role];
    const next = current ? withHue(current, h, hues[role]) : null;
    if (next) {
      if (!liveStart.current) liveStart.current = latest.current.colours;
      queueLive(role, next);
    }
  };

  const onPick = (hex: string, manual: boolean) => {
    if (!canEdit) return;
    if (!applyRoleHex(role, hex, 'MANUAL')) return;
    if (manual) setSwatches((rows) => addToPalette(rows, hex, [mainHex, accentHex, hex]));
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
          setUndo((u) => resetHistory({ ...u.current, main: main || u.current.main, accent: accent || u.current.accent }));
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
          setUndo((u) => resetHistory({ ...u.current, source: sentSource }));
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
        {logoUrl ? null : <ColoursLogoPreview logoUrl={null} canUpload={false} />}
        <SentSummary
          logoUrl={logoUrl}
          logoSize={logoSize}
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
      <VisionFilters />
      {logoUrl ? null : <ColoursLogoPreview logoUrl={null} canUpload={ctx.canUpload} />}

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
            <HubLogoMark
              src={logoUrl}
              width={logoSize?.width}
              height={logoSize?.height}
              maxHeight="96px"
              className="admin-hub-colours__logo-mark"
              testId="admin-hub-colours-logo"
            />
          ) : (
            <ColoursLogoPreview logoUrl={null} canUpload={ctx.canUpload} inPanel />
          )}
          <p className="admin-hub-cp__label" id="admin-hub-colours-found">
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
          {swatches.length ? (
            <div className="admin-hub-extract" aria-busy={extracting || undefined} role="group" aria-labelledby="admin-hub-colours-found">
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
                    aria-label={assigned ? `${assigned}, ${swatch.name} ${swatch.hex}` : `${swatch.name} ${swatch.hex}`}
                  >
                    <span className="admin-hub-extract__chip" style={{ background: swatch.hex }} />
                    <span className="admin-hub-extract__text">
                      <span className="admin-hub-extract__name">
                        {swatch.name} <span className="admin-hub-extract__hex">{swatch.hex}</span>
                      </span>
                      {swatch.share > 0 ? (
                        <span className="admin-hub-share" aria-hidden="true">
                          <span style={{ width: `${Math.max(4, Math.round(swatch.share * 100))}%` }} />
                        </span>
                      ) : null}
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
          ) : null}

          <div className="admin-hub-pairs">
            <p className="admin-hub-cp__label" id="admin-hub-colours-pairs">
              {ADMIN_HUB_COLOURS_PAIRS}
            </p>
            <p className="admin-hub-colours__hint">{ADMIN_HUB_COLOURS_PAIRS_HINT}</p>
            <div className="admin-hub-pairs__grid" role="group" aria-labelledby="admin-hub-colours-pairs">
              {BARBERSHOP_PAIRS.map((pair) => {
                const on = pair.main === mainHex && pair.accent === accentHex && pair.tone === tone;
                return (
                  <button
                    key={pair.id}
                    type="button"
                    className={`admin-hub-pair${on ? ' is-on' : ''}`}
                    onClick={() => onPair(pair)}
                    disabled={!canEdit}
                    aria-pressed={on}
                    aria-label={ADMIN_HUB_COLOURS_PAIR_LABEL(pair.label, pair.tone === 'LIGHT' ? 'light' : 'dark')}
                    data-testid={`admin-hub-pair-${pair.id}`}
                  >
                    <span className="admin-hub-pair__art" style={{ background: siteBackgroundHex(pair.tone, pair.main) }} aria-hidden="true">
                      <i style={{ background: pair.main }} />
                      <i style={{ background: pair.accent }} />
                    </span>
                    <span className="admin-hub-pair__name" aria-hidden="true">
                      {pair.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="admin-hub-colours__edit">
          <div className="admin-hub-roles" role="group" aria-label={ADMIN_HUB_COLOURS_ROLE_GROUP}>
            {(['main', 'accent'] as const).map((id) => {
              const hex = id === 'main' ? mainHex : accentHex;
              const named = roleNames[id] ?? ADMIN_HUB_COLOURS_EMPTY_ROLE;
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
                  <span className="admin-hub-role__text">
                    <span className="admin-hub-role__k">{id === 'main' ? ADMIN_HUB_COLOURS_MAIN : ADMIN_HUB_COLOURS_ACCENT}</span>
                    <span className="admin-hub-role__v">{named}</span>
                  </span>
                  <span className="admin-hub-role__hex">{hex || '—'}</span>
                </button>
              );
            })}
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
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onUndo}
              disabled={!canEdit || !undo.previous}
              aria-keyshortcuts="Control+Z Meta+Z"
            >
              <Undo2 width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
              {ADMIN_HUB_COLOURS_UNDO}
            </button>
          </div>
          <p className="admin-hub-colours__note" aria-live="polite" data-testid="admin-hub-colours-note">
            {sameHex ? ADMIN_HUB_COLOURS_SAME_HEX : ''}
          </p>
          <div className="admin-hub-cp__panel admin-hub-tuner">
            <p className="admin-hub-cp__label">
              <span className="admin-hub-tuner__dot" style={{ background: selectedHex || undefined }} aria-hidden="true" />
              {role === 'main' ? ADMIN_HUB_COLOURS_FINE_TUNE_MAIN : ADMIN_HUB_COLOURS_FINE_TUNE_ACCENT}
            </p>
            <ColourPicker
              role={role}
              hex={selectedHex}
              hue={hues[role]}
              tone={tone}
              disabled={!canEdit}
              eyedropper={eyedropper}
              onLive={onLive}
              onPick={onPick}
              onHue={onHue}
              onEyedropper={() => void pickFromScreen()}
            />
            {suggestions.length ? (
              <div className="admin-hub-suggest">
                <p className="admin-hub-picker__k">
                  <b id="admin-hub-colours-suggest">{ADMIN_HUB_COLOURS_SUGGEST}</b>
                  <span>{ADMIN_HUB_COLOURS_SUGGEST_HINT}</span>
                </p>
                <div role="group" aria-labelledby="admin-hub-colours-suggest">
                  {suggestions.map((row) => (
                    <button
                      key={row.hex}
                      type="button"
                      className="admin-hub-suggest__chip"
                      onClick={() => applyRoleHex('accent', row.hex, 'MANUAL')}
                      disabled={!canEdit}
                      aria-label={`${row.name} ${row.hex}`}
                      data-testid={`admin-hub-suggest-${row.hex.replace('#', '')}`}
                    >
                      <i style={{ background: row.hex }} aria-hidden="true" />
                      <span aria-hidden="true">{row.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="admin-hub-colours__tone">
              <p className="admin-hub-picker__k" id="admin-hub-colours-bg">
                {ADMIN_HUB_COLOURS_BG}
              </p>
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
          <div className="admin-hub-colours__looks-head">
            <p className="admin-hub-cp__label admin-hub-colours__looks-label">{ADMIN_HUB_COLOURS_LOOKS}</p>
            <div className="admin-hub-vision" role="group" aria-label={ADMIN_HUB_COLOURS_VISION}>
              {(
                [
                  ['normal', ADMIN_HUB_COLOURS_VISION_NORMAL],
                  ['deuteranopia', ADMIN_HUB_COLOURS_VISION_CB],
                  ['grey', ADMIN_HUB_COLOURS_VISION_GREY],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" className={vision === value ? 'is-on' : ''} aria-pressed={vision === value} onClick={() => setVision(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-hub-colours__looks-preview" data-vision={vision}>
            <LivePreview shop={shopLabel} mainHex={mainHex} accentHex={accentHex} tone={tone} services={services} />
            {vision !== 'normal' ? <p className="admin-hub-colours__hint admin-hub-vision__note">{ADMIN_HUB_COLOURS_VISION_NOTE[vision]}</p> : null}
          </div>
          <ReadabilityGuide
            report={report}
            tone={tone}
            canEdit={canEdit}
            hasMain={Boolean(mainHex)}
            onFixColour={onFix}
            onAccent={(hex) => applyRoleHex('accent', hex, 'MANUAL')}
            onTone={(value) => apply({ ...colours, tone: value })}
            onFixAll={onFixAll}
          />
          <p className="admin-hub-colours__guide">{ADMIN_HUB_COLOURS_GUIDE_NOTE}</p>
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
          <ConfirmSummary logoUrl={logoUrl} logoSize={logoSize} mainHex={mainHex} accentHex={accentHex} swatches={swatches} />
        </AdminHubConfirmDialog>
      ) : null}
    </div>
  );
}

/** The colour-blind simulation used by the preview's "See it as" switch (feColorMatrix works in linear RGB). */
function VisionFilters() {
  return (
    <svg className="admin-hub-vision__defs" aria-hidden="true" focusable="false" width="0" height="0">
      <filter id={VISION_FILTER_ID} colorInterpolationFilters="linearRGB">
        <feColorMatrix type="matrix" values={visionMatrix('deuteranopia')} />
      </filter>
    </svg>
  );
}

type LogoSize = { width: number; height: number } | null;

function ConfirmSummary(props: {
  logoUrl: string | null;
  logoSize: LogoSize;
  mainHex: string;
  accentHex: string;
  swatches: ExtractedSwatch[];
}) {
  const extras = props.swatches.filter((row) => row.hex !== props.mainHex && row.hex !== props.accentHex);
  return (
    <div className="admin-hub-confirm__summary">
      <div className="admin-hub-confirm__logo">
        {props.logoUrl ? (
          <HubLogoMark src={props.logoUrl} width={props.logoSize?.width} height={props.logoSize?.height} maxHeight="56px" />
        ) : (
          <span>{ADMIN_HUB_COLOURS_NO_LOGO}</span>
        )}
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
  logoSize: LogoSize;
  mainHex: string;
  accentHex: string;
  swatches: ExtractedSwatch[];
  tone: BrandBackgroundTone;
  source: BrandColoursSource;
  submittedAt: string | null;
}) {
  const extras = props.swatches.filter((row) => row.hex !== props.mainHex && row.hex !== props.accentHex);
  const names = distinctRoleNames(props.mainHex || null, props.accentHex || null);
  const rows = [
    ...(props.mainHex ? [{ label: ADMIN_HUB_COLOURS_MAIN, hex: props.mainHex, name: names.main }] : []),
    ...(props.accentHex ? [{ label: ADMIN_HUB_COLOURS_ACCENT, hex: props.accentHex, name: names.accent }] : []),
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
        <HubLogoMark
          src={props.logoUrl}
          width={props.logoSize?.width}
          height={props.logoSize?.height}
          maxHeight="96px"
          testId="admin-hub-colours-logo"
        />
      ) : null}
      <dl className="admin-hub-colours-sent__list">
        {rows.map((row) => (
          <HexRow key={row.label} label={row.label} hex={row.hex} name={row.name} />
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

function HexRow(props: { label: string; hex: string; name: string | null }) {
  return (
    <div className="admin-hub-colours-sent__row">
      <dt>{props.label}</dt>
      <dd>
        <i style={{ background: props.hex }} aria-hidden="true" />
        <span>{props.name ?? props.hex}</span>
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

/** The no-logo empty state (message + upload link). An existing logo is shown once, by HubLogoMark. */
function ColoursLogoPreview(props: {
  logoUrl: null;
  canUpload: boolean;
  inPanel?: boolean;
}) {
  return (
    <div
      className={`admin-hub-colours__logo${props.inPanel ? ' admin-hub-colours__logo--in-panel' : ''}`}
      data-testid={props.inPanel ? 'admin-hub-colours-logo-panel' : 'admin-hub-colours-logo'}
    >
      <div className="admin-hub-colours__logo-empty">
        <p>{ADMIN_HUB_COLOURS_NO_LOGO}</p>
        {props.canUpload ? (
          <a className="btn btn--outline btn--sm" href={adminHubMaterialsHref('logo')}>
            {ADMIN_HUB_COLOURS_UPLOAD}
          </a>
        ) : null}
      </div>
    </div>
  );
}


function LivePreview(props: {
  shop: string;
  mainHex: string;
  accentHex: string;
  tone: BrandBackgroundTone;
  services: Array<{ name: string }>;
  compact?: boolean;
}) {
  return (
    <div className="admin-hub-livep-wrap">
      {!props.mainHex ? (
        <p className="admin-hub-colours__prompt" data-testid="admin-hub-colours-pick-main">
          {ADMIN_HUB_COLOURS_PICK_MAIN}
        </p>
      ) : null}
      <BrandSitePreview
        size={props.compact ? 'compact' : 'full'}
        shop={props.shop}
        mainHex={props.mainHex}
        accentHex={props.accentHex}
        tone={props.tone}
        services={props.services}
        testId={props.compact ? 'admin-hub-colours-preview-compact' : 'admin-hub-colours-preview'}
      />
    </div>
  );
}
