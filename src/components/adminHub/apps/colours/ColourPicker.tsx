import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pipette } from '@/components/lucide-react';
import {
  ADMIN_HUB_COLOURS_AREA_HELP,
  ADMIN_HUB_COLOURS_AREA_LABEL,
  ADMIN_HUB_COLOURS_AREA_VALUE,
  ADMIN_HUB_COLOURS_HEX_ERROR_CHARS,
  ADMIN_HUB_COLOURS_HEX_ERROR_LENGTH,
  ADMIN_HUB_COLOURS_HEX_LABEL,
  ADMIN_HUB_COLOURS_HUE,
  ADMIN_HUB_COLOURS_HUE_VALUE,
  ADMIN_HUB_COLOURS_PICK_SCREEN,
  ADMIN_HUB_COLOURS_SHADE,
  ADMIN_HUB_COLOURS_SHADES,
  ADMIN_HUB_COLOURS_STRIPES_ACCENT,
  ADMIN_HUB_COLOURS_STRIPES_MAIN,
} from '@/lib/adminHub/copy';
import {
  BUTTON_INK,
  BUTTON_TEXT_RATIO,
  MAIN_BG_RATIO,
  SITE_BACKGROUND,
  hexAtPoint,
  hueName,
  hueStripGradient,
  hueSwatch,
  nameSwatch,
  hexToClampedOklch,
  paintPickerArea,
  parseHexInput,
  pickerPoint,
  relativeLuminance,
  shadeSteps,
  type BrandBackgroundTone,
  type ColourRole,
  type OkLch,
  type PickerPoint,
} from '@/lib/adminHub/colour';
import { oklabToLinearSrgb, oklchToOklab } from '@/lib/adminHub/colour/space';

export type PickerPhase = 'start' | 'move' | 'end';

const HUE_GRADIENT = hueStripGradient();
const INK_LUM = relativeLuminance(BUTTON_INK);
const MAX_CANVAS_EDGE = 640;
const KEY_STEP = 0.02;
const KEY_STEP_BIG = 0.1;

const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function linearLum(lch: OkLch): number {
  const lin = oklabToLinearSrgb(oklchToOklab(lch));
  const c = (n: number) => Math.max(0, Math.min(1, n));
  return 0.2126 * c(lin.r) + 0.7152 * c(lin.g) + 0.0722 * c(lin.b);
}

/** Per-pixel readability for the stripes: the same rules as the guide's required checks. */
function readableFor(role: ColourRole, tone: BrandBackgroundTone) {
  if (role === 'accent') {
    return (lum: number) => Math.max(ratio(lum, 1), ratio(lum, INK_LUM)) >= BUTTON_TEXT_RATIO;
  }
  const spec = SITE_BACKGROUND[tone === 'LIGHT' ? 'LIGHT' : 'DARK'];
  return (lum: number, lch: OkLch) => ratio(lum, linearLum({ L: spec.L, C: Math.min(lch.C, spec.maxC), h: lch.h })) >= MAIN_BG_RATIO;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * The colour picker of the Brand colours app: an OKLCH area (lightness × intensity) for one hue, a hue strip,
 * the hex box and seven shades. The hard-to-read part of the area is striped for the role being edited.
 * Dragging reports `start` / `move` / `end` so the app commits one undo step per drag.
 */
export function ColourPicker(props: {
  role: ColourRole;
  hex: string;
  hue: number;
  tone: BrandBackgroundTone;
  disabled: boolean;
  eyedropper: boolean;
  onLive: (hex: string, phase: PickerPhase) => void;
  onPick: (hex: string, manual: boolean) => void;
  onHue: (hue: number, phase: PickerPhase) => void;
  onEyedropper: () => void;
}) {
  const { role, hex, hue, tone, disabled } = props;
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [drag, setDrag] = useState<PickerPoint | null>(null);
  const keyActive = useRef(false);

  // Canvas follows the area's CSS size at device resolution (capped).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      const scale = Math.min(dpr, MAX_CANVAS_EDGE / rect.width);
      setSize({ w: Math.max(2, Math.round(rect.width * scale)), h: Math.max(2, Math.round(rect.height * scale)) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const image = ctx.createImageData(size.w, size.h);
    paintPickerArea(image.data, {
      width: size.w,
      height: size.h,
      hue,
      readable: readableFor(role, tone),
      stripe: Math.round(size.w / 48),
    });
    ctx.putImageData(image, 0, 0);
  }, [hue, role, size, tone]);

  const point: PickerPoint | null = drag ?? (hex ? pickerPoint(hex, hue) : null);
  const shown = point ?? { x: 0.72, y: 0.4, h: hue };
  const lightPct = Math.round((1 - shown.y) * 100);
  const vividPct = Math.round(shown.x * 100);

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>): PickerPoint | null => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height), h: hue };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const next = pointFromEvent(event);
    if (!next) return;
    event.preventDefault();
    areaRef.current?.setPointerCapture?.(event.pointerId);
    thumbRef.current?.focus({ preventScroll: true });
    setDrag(next);
    props.onLive(hexAtPoint(next), 'start');
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const next = pointFromEvent(event);
    if (!next) return;
    setDrag(next);
    props.onLive(hexAtPoint(next), 'move');
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    areaRef.current?.releasePointerCapture?.(event.pointerId);
    const next = pointFromEvent(event) ?? drag;
    setDrag(null);
    props.onLive(hexAtPoint(next), 'end');
  };

  const onThumbKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    let { x, y } = shown;
    switch (event.key) {
      case 'ArrowLeft':
        x -= step;
        break;
      case 'ArrowRight':
        x += step;
        break;
      case 'ArrowUp':
        y -= step;
        break;
      case 'ArrowDown':
        y += step;
        break;
      case 'PageUp':
        y -= KEY_STEP_BIG;
        break;
      case 'PageDown':
        y += KEY_STEP_BIG;
        break;
      case 'Home':
        x = 0;
        break;
      case 'End':
        x = 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = { x: clamp01(x), y: clamp01(y), h: hue };
    props.onLive(hexAtPoint(next), keyActive.current ? 'move' : 'start');
    keyActive.current = true;
  };

  const onThumbKeyUp = () => {
    if (!keyActive.current) return;
    keyActive.current = false;
    props.onLive('', 'end');
  };

  const shades = hex ? shadeSteps(hex, 7, hue) : [];
  const hueDeg = Math.round(hue) % 360;
  const stripes = role === 'main' ? ADMIN_HUB_COLOURS_STRIPES_MAIN(tone === 'LIGHT' ? 'light' : 'dark') : ADMIN_HUB_COLOURS_STRIPES_ACCENT;

  return (
    <div className="admin-hub-picker" data-role={role}>
      <div
        ref={areaRef}
        className={`admin-hub-picker__area${disabled ? ' is-disabled' : ''}${drag ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="admin-hub-picker-area"
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        <div
          ref={thumbRef}
          className={`admin-hub-picker__thumb${hex ? '' : ' is-empty'}`}
          style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, background: hex || undefined }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ADMIN_HUB_COLOURS_AREA_LABEL}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={lightPct}
          aria-valuetext={ADMIN_HUB_COLOURS_AREA_VALUE(lightPct, vividPct)}
          aria-describedby="admin-hub-picker-help"
          aria-disabled={disabled || undefined}
          onKeyDown={onThumbKey}
          onKeyUp={onThumbKeyUp}
          onBlur={onThumbKeyUp}
        />
      </div>
      <p className="admin-hub-picker__legend">
        <span className="admin-hub-picker__stripe" aria-hidden="true" />
        {stripes}
      </p>
      <p className="admin-hub-sr-only" id="admin-hub-picker-help">
        {ADMIN_HUB_COLOURS_AREA_HELP}
      </p>

      <label className="admin-hub-picker__hue" style={{ ['--admin-hub-hue-thumb' as string]: hueSwatch(hue) }}>
        <span className="admin-hub-sr-only">{ADMIN_HUB_COLOURS_HUE}</span>
        <span className="admin-hub-picker__hue-track" style={{ background: HUE_GRADIENT }} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={hueDeg}
          disabled={disabled}
          aria-valuetext={ADMIN_HUB_COLOURS_HUE_VALUE(hueName(hueDeg), hueDeg)}
          onChange={(event) => props.onHue(Number(event.target.value), 'move')}
          onPointerDown={() => props.onHue(hueDeg, 'start')}
          onPointerUp={() => props.onHue(hueDeg, 'end')}
          onKeyDown={(event) => {
            if (event.key.startsWith('Arrow') || event.key.startsWith('Page') || event.key === 'Home' || event.key === 'End') {
              props.onHue(hueDeg, 'start');
            }
          }}
          onKeyUp={() => props.onHue(hueDeg, 'end')}
          onBlur={() => props.onHue(hueDeg, 'end')}
        />
      </label>

      <div className="admin-hub-picker__row">
        <span className={`admin-hub-picker__chip${hex ? '' : ' is-empty'}`} style={{ background: hex || undefined }} aria-hidden="true" />
        <HexField hex={hex} disabled={disabled} onPick={(value) => props.onPick(value, true)} />
        {props.eyedropper ? (
          <button
            type="button"
            className="btn btn--outline btn--sm admin-hub-picker__drop"
            onClick={props.onEyedropper}
            disabled={disabled}
            aria-label={ADMIN_HUB_COLOURS_PICK_SCREEN}
            title={ADMIN_HUB_COLOURS_PICK_SCREEN}
          >
            <Pipette width={16} height={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {shades.length ? (
        <div className="admin-hub-picker__shades">
          <p className="admin-hub-picker__k" id="admin-hub-picker-shades">
            {ADMIN_HUB_COLOURS_SHADES}
          </p>
          <div role="group" aria-labelledby="admin-hub-picker-shades">
            {shades.map((value) => {
              const lch = hexToClampedOklch(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={value === hex ? 'is-cur' : ''}
                  style={{ background: value }}
                  aria-label={ADMIN_HUB_COLOURS_SHADE(lch ? nameSwatch(lch) : '', value)}
                  aria-pressed={value === hex}
                  disabled={disabled}
                  onClick={() => props.onPick(value, false)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Always-visible hex box: shows the current colour, validates while typing, Enter / leaving the box applies, Esc reverts. */
function HexField(props: { hex: string; disabled: boolean; onPick: (hex: string) => void }) {
  const [draft, setDraft] = useState(props.hex);
  const [focused, setFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(props.hex);
  }, [focused, props.hex]);

  const check = parseHexInput(draft, submitted);
  const error = check.ok
    ? null
    : check.reason === 'chars'
      ? ADMIN_HUB_COLOURS_HEX_ERROR_CHARS
      : check.reason === 'length'
        ? ADMIN_HUB_COLOURS_HEX_ERROR_LENGTH
        : null;

  const apply = (): boolean => {
    setSubmitted(true);
    const parsed = parseHexInput(draft, true);
    if (!parsed.ok) return false;
    setSubmitted(false);
    setDraft(parsed.hex);
    if (parsed.hex !== props.hex) props.onPick(parsed.hex);
    return true;
  };

  return (
    <div className="admin-hub-picker__hex">
      <label>
        <span className="admin-hub-picker__k">{ADMIN_HUB_COLOURS_HEX_LABEL}</span>
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSubmitted(false);
          }}
          onFocus={(event) => {
            setFocused(true);
            event.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            if (draft.trim() && draft !== props.hex && apply()) return;
            setSubmitted(false);
            setDraft(props.hex);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setSubmitted(false);
              setDraft(props.hex);
            }
          }}
          placeholder="#1F6F6B"
          spellCheck={false}
          autoComplete="off"
          maxLength={9}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'admin-hub-colours-hex-error' : undefined}
          disabled={props.disabled}
        />
      </label>
      {error ? (
        <p className="admin-hub-colours__field-error" id="admin-hub-colours-hex-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
