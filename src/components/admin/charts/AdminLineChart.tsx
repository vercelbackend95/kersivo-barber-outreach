import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  buildAreaPath,
  buildLinearPath,
  buildSmoothPath,
  niceTicks,
  snapIndex,
  sortChartLabels,
  uniqueTicksByLabel,
  type ChartPoint,
} from '@/lib/admin/chartUtils';

export type AdminLineChartPoint = { label: string; value: number };

export type AdminLineChartSeries = {
  key: string;
  name: string;
  points: AdminLineChartPoint[];
};

type TooltipState = {
  label: string;
  entries: Array<{ key: string; name: string; value: number; color: string; prev: number | null }>;
  prevLabel: string | null;
  crosshairX: number;
  activeIndex: number;
} | null;

export type AdminLineChartProps = {
  series: AdminLineChartSeries[];
  getColor: (seriesKey: string) => string;
  getStrokeWidth?: (seriesKey: string) => number;
  /** 'currency' assumes values in pence → formats as £; 'number' formats as integer */
  metric?: 'currency' | 'number';
  /** Overrides default tooltip value formatting */
  formatValue?: (value: number) => string;
  height?: number | string;
  /** Attach ResizeObserver to auto-update dimensions */
  responsive?: boolean;
  /** 'sparkline' = compact, area fill, no axes. 'chart' = full axes, grid, multi-series */
  variant?: 'sparkline' | 'chart';
  /** Modifier CSS class applied to line + area paths (e.g. 'is-warning') */
  getPathClassName?: (seriesKey: string) => string;
  emptyLabel?: string;
  emptyNode?: React.ReactNode;
  onExpand?: () => void;
  isFullscreen?: boolean;
  ariaLabel?: string;
  curve?: 'linear' | 'smooth';
  showArea?: boolean | ((seriesKey: string) => boolean);
  showCrosshair?: boolean;
  primarySeriesKey?: string;
  hideAxisTitles?: boolean;
  /** Extra top padding (px) to reserve space for an HTML overlay headline */
  contentInsetTop?: number;
  /**
   * When true, hold the stroke-draw until the chart root intersects the viewport
   * (landing LP). Admin defaults to immediate draw on mount.
   */
  drawWhenVisible?: boolean;
};

const TOOLTIP_MAX_W = 220;
const GRID_TICK_COUNT = 3;
/** Point markers only while they read as points, not as a beaded line. */
const MARKER_MAX_POINTS = 14;
const LINE_DRAW_MS = 850;
const LINE_DRAW_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}

type AnimatedLineSeriesProps = {
  seriesKey: string;
  linePath: string;
  areaPath: string | null;
  /** Stable data identity (labels+values) — layout-only path changes should not re-draw. */
  dataFingerprint: string;
  color: string;
  strokeWidth: number;
  isSparkline: boolean;
  extraClass: string;
  gradientId: string;
  activeDot: { cx: number; cy: number } | null;
  /** When false, keep the line hidden until the parent allows draw. */
  allowDraw: boolean;
  /** Primary series only: a soft glow under the line, point markers and the latest-value dot. */
  emphasis?: {
    markers: Array<{ cx: number; cy: number }>;
    endDot: { cx: number; cy: number } | null;
  } | null;
};

function AnimatedLineSeries({
  seriesKey,
  linePath,
  areaPath,
  dataFingerprint,
  color,
  strokeWidth,
  isSparkline,
  extraClass,
  gradientId,
  activeDot,
  allowDraw,
  emphasis,
}: AnimatedLineSeriesProps) {
  const lineRef = useRef<SVGPathElement>(null);
  /** Everything that fades in behind the drawn line: area, glow, markers. */
  const fadeRef = useRef<SVGGElement>(null);
  const markersRef = useRef<SVGGElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const drawnFingerprintRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const line = lineRef.current;
    const fades = [fadeRef.current, markersRef.current].filter((el): el is SVGGElement => el !== null);
    if (!line || !linePath) return undefined;

    const alreadyDrawn = drawnFingerprintRef.current === dataFingerprint;
    const showAll = () => {
      line.style.transition = 'none';
      line.style.strokeDasharray = 'none';
      line.style.strokeDashoffset = '0';
      fades.forEach((fade) => {
        fade.style.transition = 'none';
        fade.style.opacity = '1';
      });
    };

    // Reduced motion, or a resize / reflow only: keep everything visible, no re-draw.
    if (reduceMotion || alreadyDrawn) {
      showAll();
      drawnFingerprintRef.current = dataFingerprint;
      return undefined;
    }

    let length = 0;
    try {
      length = line.getTotalLength();
    } catch {
      length = 0;
    }

    if (!Number.isFinite(length) || length <= 0) {
      showAll();
      drawnFingerprintRef.current = dataFingerprint;
      return undefined;
    }

    line.style.transition = 'none';
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
    fades.forEach((fade) => {
      fade.style.transition = 'none';
      fade.style.opacity = '0';
    });

    // Wait until the chart is allowed to draw (viewport gate on landing).
    if (!allowDraw) {
      return undefined;
    }

    // Force layout so the browser commits the "hidden" state before animating.
    void line.getBoundingClientRect();

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        line.style.transition = `stroke-dashoffset ${LINE_DRAW_MS}ms ${LINE_DRAW_EASING}`;
        line.style.strokeDashoffset = '0';
        // The fill and markers settle in behind the pen, not ahead of it.
        fades.forEach((fade) => {
          fade.style.transition = `opacity ${LINE_DRAW_MS}ms ${LINE_DRAW_EASING} ${Math.round(LINE_DRAW_MS * 0.35)}ms`;
          fade.style.opacity = '1';
        });
        drawnFingerprintRef.current = dataFingerprint;
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [linePath, dataFingerprint, reduceMotion, seriesKey, allowDraw]);

  return (
    <g style={{ color }}>
      <g ref={fadeRef} style={reduceMotion ? undefined : { opacity: 0 }}>
        {areaPath ? (
          <path
            d={areaPath}
            fill={isSparkline ? undefined : `url(#${gradientId})`}
            className={
              isSparkline
                ? `admin-revenue-chart-area admin-chart-area--draw ${extraClass}`
                : `admin-chart-area admin-chart-area--draw ${extraClass}`
            }
            stroke="none"
          />
        ) : null}
        {emphasis ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth + 7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="admin-chart-line-glow"
          />
        ) : null}
      </g>
      <path
        ref={lineRef}
        d={linePath}
        fill="none"
        stroke={isSparkline ? undefined : color}
        strokeWidth={isSparkline ? undefined : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          isSparkline
            ? `admin-revenue-chart-line admin-chart-line admin-chart-line--draw ${extraClass}`
            : 'admin-chart-line admin-chart-line--draw'
        }
      />
      {emphasis ? (
        <g ref={markersRef} className="admin-chart-markers" style={reduceMotion ? undefined : { opacity: 0 }}>
          {emphasis.markers.map((m) => (
            <circle key={`${m.cx}-${m.cy}`} cx={m.cx} cy={m.cy} r="3" className="admin-chart-marker" />
          ))}
        </g>
      ) : null}
      {emphasis?.endDot && !activeDot ? (
        <g className="admin-chart-end-dot" transform={`translate(${emphasis.endDot.cx} ${emphasis.endDot.cy})`}>
          <circle r="9" className="admin-chart-end-dot__pulse" fill={color} />
          <circle r="4" className="admin-chart-end-dot__core" fill={color} />
        </g>
      ) : null}
      {activeDot ? (
        <g transform={`translate(${activeDot.cx} ${activeDot.cy})`} className="admin-chart-active">
          <circle r="11" fill={color} className="admin-chart-active-halo" />
          <circle r="5" fill={color} className="admin-chart-active-dot" />
        </g>
      ) : null}
    </g>
  );
}

function defaultFormatValue(value: number, metric?: 'currency' | 'number'): string {
  if (metric === 'currency') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }
  return String(Math.round(value));
}

function defaultFormatAxisValue(value: number, metric?: 'currency' | 'number'): string {
  if (metric === 'currency') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value / 100);
  }
  return String(Math.round(value));
}

function formatTooltipDateLabel(label: string): string {
  if (/^\d{2}:00$/.test(label)) return label;
  const isoTs = Date.parse(`${label}T00:00:00`);
  if (!Number.isNaN(isoTs)) {
    return new Date(isoTs).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  return label;
}

function formatXAxisLabel(label: string, labelCount: number): string {
  if (/^\d{2}:00$/.test(label)) return label;
  const isoTs = Date.parse(`${label}T00:00:00`);
  if (!Number.isNaN(isoTs)) {
    const d = new Date(isoTs);
    if (labelCount <= 8) {
      return d.toLocaleDateString('en-GB', { weekday: 'short' });
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  return label;
}

function shouldShowArea(
  seriesKey: string,
  showArea: boolean | ((key: string) => boolean) | undefined,
  primarySeriesKey: string | undefined,
  safeSeries: AdminLineChartSeries[],
): boolean {
  if (typeof showArea === 'function') return showArea(seriesKey);
  if (typeof showArea === 'boolean') return showArea;
  const primary = primarySeriesKey ?? safeSeries[0]?.key;
  return seriesKey === primary;
}

export default function AdminLineChart({
  series,
  getColor,
  getStrokeWidth,
  metric,
  formatValue,
  height,
  responsive = false,
  variant = 'chart',
  getPathClassName,
  emptyLabel = 'No data',
  emptyNode,
  onExpand,
  isFullscreen = false,
  ariaLabel,
  curve,
  showArea,
  showCrosshair = true,
  primarySeriesKey,
  hideAxisTitles = true,
  contentInsetTop,
  drawWhenVisible = false,
}: AdminLineChartProps) {
  const isSparkline = variant === 'sparkline';
  const useCurve = curve ?? (isSparkline ? 'linear' : 'smooth');
  const gradientId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 900, height: isSparkline ? 88 : 320 });
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [allowDraw, setAllowDraw] = useState(!drawWhenVisible);

  useEffect(() => {
    if (!drawWhenVisible) {
      setAllowDraw(true);
      return undefined;
    }
    if (allowDraw) return undefined;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setAllowDraw(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setAllowDraw(true);
          io.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [allowDraw, drawWhenVisible]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const update = () => {
      const w = Math.max(100, Math.round(el.clientWidth));
      const h = Math.max(40, Math.round(el.clientHeight));
      setDims((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    update();

    if (!responsive || typeof ResizeObserver === 'undefined') return undefined;

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [responsive]);

  const basePadding = isSparkline
    ? { top: 8, right: 8, bottom: 8, left: 8 }
    : { top: 16, right: 16, bottom: 32, left: 12 };
  const padding = {
    ...basePadding,
    top: basePadding.top + (contentInsetTop ?? 0),
  };

  const svgW = dims.width;
  const svgH = dims.height;
  const innerW = svgW - padding.left - padding.right;
  const innerH = svgH - padding.top - padding.bottom;

  const safeSeries = series.filter((s) => s.points.length > 0);

  const rawLabels = Array.from(
    new Set(safeSeries.flatMap((s) => s.points.map((p) => p.label))),
  );
  const sortedLabels = sortChartLabels(
    rawLabels.length > 0 ? rawLabels : safeSeries[0]?.points.map((p) => p.label) ?? [],
  );

  const allValues = safeSeries.flatMap((s) => s.points.map((p) => p.value));
  const rawMax = allValues.length > 0 ? Math.max(0, ...allValues) : 0;
  const rawMin = allValues.length > 0 ? Math.min(0, ...allValues) : 0;
  const minFloor = metric === 'currency' ? 100 : 1;
  const { min: yMin, max: yMax, ticks: yTicks } = niceTicks(
    Math.min(0, rawMin),
    Math.max(rawMax, minFloor),
    GRID_TICK_COUNT,
  );
  const yRange = Math.max(1, yMax - yMin);

  const isEmpty = safeSeries.length === 0 || allValues.every((v) => v === 0);

  const xPos = (label: string): number => {
    if (sortedLabels.length <= 1) return padding.left + innerW / 2;
    const idx = sortedLabels.indexOf(label);
    if (idx < 0) return padding.left;
    return padding.left + (idx / (sortedLabels.length - 1)) * innerW;
  };

  const yPos = (value: number): number =>
    padding.top + (1 - (value - yMin) / yRange) * innerH;

  const fmtTooltipValue = formatValue ?? ((v: number) => defaultFormatValue(v, metric));
  const fmtAxisValue = (v: number) => defaultFormatAxisValue(v, metric);
  const gridTicks = uniqueTicksByLabel(yTicks, fmtAxisValue);
  const primaryKey = primarySeriesKey ?? safeSeries[0]?.key;

  const estimateYLabelWidth = (label: string) => Math.max(36, label.length * 7 + 12);

  // As many labels as the width allows (~72px each), counted back from the latest point so the
  // newest day is always labelled and the spacing stays even (no crowded last pair).
  const maxXLabels = Math.max(2, Math.floor(innerW / 72));
  const xLabelStep = Math.max(1, Math.ceil(sortedLabels.length / maxXLabels));
  const xTickLabels = sortedLabels.filter((label, i) => {
    if (label === 'start' || label === 'end') return false;
    return (sortedLabels.length - 1 - i) % xLabelStep === 0;
  });

  const buildSeriesPath = (points: AdminLineChartPoint[]): string => {
    const orderedPoints = sortedLabels.map((label) => ({
      label,
      value: points.find((p) => p.label === label)?.value ?? 0,
    }));
    const chartPoints: ChartPoint[] = orderedPoints.map((p) => ({
      x: xPos(p.label),
      y: yPos(p.value),
    }));
    return useCurve === 'smooth' ? buildSmoothPath(chartPoints) : buildLinearPath(chartPoints);
  };

  const showTooltipAt = (idx: number) => {
    if (isEmpty || sortedLabels.length === 0) return;
    const clamped = Math.max(0, Math.min(sortedLabels.length - 1, idx));
    const label = sortedLabels[clamped];
    const prevLabel = clamped > 0 ? sortedLabels[clamped - 1] : null;
    const crosshairX = xPos(label);
    const entries = safeSeries.map((s) => {
      const pt = s.points.find((p) => p.label === label);
      const prevPt = prevLabel ? s.points.find((p) => p.label === prevLabel) : null;
      return {
        key: s.key,
        name: s.name,
        value: pt?.value ?? 0,
        color: getColor(s.key),
        prev: prevLabel ? prevPt?.value ?? 0 : null,
      };
    });
    setTooltip({ label, entries, crosshairX, activeIndex: clamped, prevLabel });
  };

  const updateTooltipFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el || sortedLabels.length === 0) return;
    const rect = el.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const svgMouseX = (mouseX / rect.width) * svgW;
    showTooltipAt(snapIndex(svgMouseX, padding.left, innerW, sortedLabels.length));
  };

  /** Arrow keys walk the points, Home/End jump, Escape clears (the chart is a focus stop). */
  const handleKeyNav = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEmpty || sortedLabels.length === 0) return;
    const current = tooltip?.activeIndex ?? sortedLabels.length;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = tooltip ? current + 1 : 0;
    else if (event.key === 'ArrowLeft') next = tooltip ? current - 1 : sortedLabels.length - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = sortedLabels.length - 1;
    else if (event.key === 'Escape') {
      setTooltip(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    showTooltipAt(next);
  };

  const formatDelta = (value: number, prev: number | null): { text: string; tone: 'up' | 'down' | 'flat' } | null => {
    if (prev === null) return null;
    const diff = value - prev;
    if (diff === 0) return { text: 'No change', tone: 'flat' };
    const sign = diff > 0 ? '+' : '−';
    const pct = prev > 0 ? ` (${sign}${Math.round((Math.abs(diff) / prev) * 100)}%)` : '';
    return { text: `${sign}${fmtTooltipValue(Math.abs(diff))}${pct}`, tone: diff > 0 ? 'up' : 'down' };
  };

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    if (clientX == null) return;
    updateTooltipFromClientX(clientX);
  };

  const handlePointerLeave = () => { setTooltip(null); };

  const activeLabel = tooltip?.label;

  const svgNode = (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      className={isSparkline ? 'admin-revenue-chart-svg' : 'admin-sales-chart-svg'}
      aria-hidden="true"
    >
      <defs>
        {safeSeries.map((s) => {
          const color = getColor(s.key);
          return (
            <linearGradient
              key={`grad-${s.key}`}
              id={`${gradientId}-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="55%" stopColor={color} stopOpacity="0.07" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          );
        })}
      </defs>

      {!isSparkline &&
        gridTicks.map((tick) => {
          if ((contentInsetTop ?? 0) > 0 && tick === yMax) return null;
          const label = fmtAxisValue(tick);
          const labelWidth = estimateYLabelWidth(label);
          const labelY = yPos(tick);
          const isBaseline = tick === yMin;
          return (
            <g key={`ytick-${tick}`}>
              <line
                x1={padding.left}
                y1={labelY}
                x2={svgW - padding.right}
                y2={labelY}
                className={isBaseline ? 'admin-chart-baseline' : 'admin-sales-grid-line'}
              />
              {/* The label sits just above its line, so the line never strikes through it. */}
              <g className="admin-chart-y-label" transform={`translate(${padding.left + 2}, ${labelY - 22 < 2 ? labelY + 4 : labelY - 22})`}>
                <rect
                  className="admin-chart-y-label-bg"
                  width={labelWidth}
                  height={18}
                  rx={4}
                  x={0}
                  y={0}
                />
                <text
                  x={6}
                  y={13}
                  textAnchor="start"
                  className="admin-sales-axis-label admin-sales-axis-label--floating"
                >
                  {label}
                </text>
              </g>
            </g>
          );
        })}

      {isSparkline && (
        <line
          x1={padding.left}
          y1={yPos(yMin)}
          x2={svgW - padding.right}
          y2={yPos(yMin)}
          className="admin-revenue-chart-axis"
        />
      )}

      {isEmpty && isSparkline && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="admin-revenue-chart-empty"
        >
          {emptyLabel}
        </text>
      )}

      {!isEmpty &&
        safeSeries.map((s) => {
          const linePath = buildSeriesPath(s.points);
          const extraClass = getPathClassName ? getPathClassName(s.key) : '';
          const color = getColor(s.key);
          const strokeWidth = getStrokeWidth ? getStrokeWidth(s.key) : 2;
          const showSeriesArea = isSparkline || shouldShowArea(s.key, showArea, primarySeriesKey, safeSeries);
          const firstLabel = sortedLabels[0];
          const lastLabel = sortedLabels[sortedLabels.length - 1];
          const firstX = firstLabel ? xPos(firstLabel) : 0;
          const lastX = lastLabel ? xPos(lastLabel) : 0;
          const baseline = yPos(yMin);
          const areaPath = showSeriesArea
            ? buildAreaPath(linePath, firstX, lastX, baseline)
            : null;
          const activePt = !isSparkline && activeLabel
            ? s.points.find((pt) => pt.label === activeLabel)
            : null;
          const isPrimary = !isSparkline && s.key === primaryKey;
          const ordered = sortedLabels
            .map((label) => s.points.find((pt) => pt.label === label))
            .filter((pt): pt is AdminLineChartPoint => Boolean(pt));
          const last = ordered[ordered.length - 1];
          const emphasis = isPrimary
            ? {
                markers: sortedLabels.length <= MARKER_MAX_POINTS
                  ? ordered.map((pt) => ({ cx: xPos(pt.label), cy: yPos(pt.value) }))
                  : [],
                endDot: last ? { cx: xPos(last.label), cy: yPos(last.value) } : null,
              }
            : null;

          return (
            <AnimatedLineSeries
              key={s.key}
              seriesKey={s.key}
              linePath={linePath}
              areaPath={areaPath}
              dataFingerprint={s.points.map((p) => `${p.label}:${p.value}`).join('|')}
              color={color}
              strokeWidth={strokeWidth}
              isSparkline={isSparkline}
              extraClass={extraClass}
              gradientId={`${gradientId}-${s.key}`}
              allowDraw={allowDraw}
              emphasis={emphasis}
              activeDot={
                activePt
                  ? { cx: xPos(activePt.label), cy: yPos(activePt.value) }
                  : null
              }
            />
          );
        })}

      {!isSparkline && showCrosshair && tooltip && (
        <line
          x1={tooltip.crosshairX}
          y1={padding.top}
          x2={tooltip.crosshairX}
          y2={svgH - padding.bottom}
          className="admin-chart-crosshair"
        />
      )}

      {!isSparkline &&
        xTickLabels.map((label) => (
          <text
            key={`x-${label}`}
            x={xPos(label)}
            y={svgH - 10}
            // Edge labels anchor inwards so "Thu" and "Wed" are never cut by the canvas edge.
            textAnchor={
              sortedLabels.length > 1 && label === sortedLabels[0]
                ? 'start'
                : sortedLabels.length > 1 && label === sortedLabels[sortedLabels.length - 1]
                  ? 'end'
                  : 'middle'
            }
            className={`admin-sales-axis-label${label === activeLabel ? ' is-active' : ''}`}
          >
            {formatXAxisLabel(label, sortedLabels.length)}
          </text>
        ))}

      {!isSparkline && !hideAxisTitles && (
        <>
          <text
            x={padding.left + innerW / 2}
            y={svgH - 2}
            textAnchor="middle"
            className="admin-sales-axis-title"
          >
            Date
          </text>
          <text
            x={14}
            y={padding.top + innerH / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${padding.top + innerH / 2})`}
            className="admin-sales-axis-title"
          >
            {metric === 'currency' ? 'Value (GBP)' : 'Value'}
          </text>
        </>
      )}
    </svg>
  );

  const tooltipLeft = tooltip
    ? Math.min(
        Math.max(8, (tooltip.crosshairX / svgW) * dims.width + 12),
        dims.width - TOOLTIP_MAX_W - 8,
      )
    : 0;

  const tooltipNode = tooltip ? (
    <div
      className="admin-chart-tooltip"
      style={{ left: tooltipLeft, top: 8 }}
      aria-hidden="true"
    >
      <p className="admin-chart-tooltip-label">
        {formatTooltipDateLabel(tooltip.label)}
      </p>
      {tooltip.entries.map((e) => (
        <p key={e.key} className="admin-chart-tooltip-entry">
          <span
            className="admin-chart-tooltip-dot"
            style={{ background: e.color }}
          />
          <span className="admin-chart-tooltip-name">{e.name}</span>
          <span className="admin-chart-tooltip-value">
            {fmtTooltipValue(e.value)}
          </span>
        </p>
      ))}
      {(() => {
        const primary = tooltip.entries.find((e) => e.key === primaryKey) ?? tooltip.entries[0];
        const delta = primary ? formatDelta(primary.value, primary.prev) : null;
        if (!delta || !tooltip.prevLabel) return null;
        return (
          <p className={`admin-chart-tooltip-delta is-${delta.tone}`}>
            {delta.text}
            <span> vs {formatTooltipDateLabel(tooltip.prevLabel)}</span>
          </p>
        );
      })()}
    </div>
  ) : null;

  const pointerHandlers = {
    onMouseMove: handlePointerMove,
    onMouseLeave: handlePointerLeave,
    onTouchStart: handlePointerMove,
    onTouchMove: handlePointerMove,
    onTouchEnd: handlePointerLeave,
  };

  if (isSparkline) {
    return (
      <div
        ref={containerRef}
        className="admin-revenue-chart"
        role="img"
        aria-label={ariaLabel ?? 'Trend over selected period'}
        style={{ position: 'relative' }}
        {...pointerHandlers}
      >
        {svgNode}
        {tooltipNode}
      </div>
    );
  }

  const emptyOverlay =
    isEmpty && !isSparkline ? (
      <div className="admin-sales-chart-overlay" aria-live="polite">
        {emptyNode ?? <p>{emptyLabel}</p>}
      </div>
    ) : null;

  return (
    <div
      className={`admin-sales-chart-inner ${isFullscreen ? 'admin-sales-chart-inner--fullscreen' : ''}`}
    >
      <div
        ref={containerRef}
        className={`admin-sales-chart-canvas ${onExpand ? 'admin-sales-chart-canvas--clickable' : ''}`}
        style={{
          ...(height ? { height } : {}),
          touchAction: onExpand ? 'manipulation' : 'pan-y',
        }}
        onClick={onExpand}
        role={onExpand ? 'button' : undefined}
        tabIndex={onExpand || !isEmpty ? 0 : undefined}
        onKeyDown={(event) => {
          if (onExpand && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onExpand();
            return;
          }
          handleKeyNav(event);
        }}
        onBlur={handlePointerLeave}
        aria-label={
          onExpand
            ? 'Tap to expand sales chart'
            : (ariaLabel ?? `Sales ${metric === 'currency' ? 'revenue' : 'chart'}`)
        }
        {...pointerHandlers}
      >
        {svgNode}
        {tooltipNode}
        {emptyOverlay}
        <span className="sr-only" aria-live="polite">
          {tooltip
            ? `${formatTooltipDateLabel(tooltip.label)}: ${tooltip.entries.map((e) => `${e.name} ${fmtTooltipValue(e.value)}`).join(', ')}`
            : ''}
        </span>
      </div>
    </div>
  );
}
