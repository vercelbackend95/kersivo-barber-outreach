import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  buildAreaPath,
  buildLinearPath,
  buildSmoothPath,
  niceTicks,
  snapIndex,
  sortChartLabels,
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
  entries: Array<{ key: string; name: string; value: number; color: string }>;
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
};

const TOOLTIP_MAX_W = 220;
const GRID_TICK_COUNT = 3;
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
}: AnimatedLineSeriesProps) {
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const drawnFingerprintRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const line = lineRef.current;
    if (!line || !linePath) return undefined;

    const alreadyDrawn = drawnFingerprintRef.current === dataFingerprint;

    if (reduceMotion) {
      line.style.transition = 'none';
      line.style.strokeDasharray = 'none';
      line.style.strokeDashoffset = '0';
      if (areaRef.current) {
        areaRef.current.style.transition = 'none';
        areaRef.current.style.opacity = '1';
      }
      drawnFingerprintRef.current = dataFingerprint;
      return undefined;
    }

    // Resize / reflow only: keep the line fully visible, no re-draw.
    if (alreadyDrawn) {
      line.style.transition = 'none';
      line.style.strokeDasharray = 'none';
      line.style.strokeDashoffset = '0';
      if (areaRef.current) {
        areaRef.current.style.transition = 'none';
        areaRef.current.style.opacity = '1';
      }
      return undefined;
    }

    let length = 0;
    try {
      length = line.getTotalLength();
    } catch {
      length = 0;
    }

    if (!Number.isFinite(length) || length <= 0) {
      line.style.strokeDasharray = 'none';
      line.style.strokeDashoffset = '0';
      if (areaRef.current) areaRef.current.style.opacity = '1';
      drawnFingerprintRef.current = dataFingerprint;
      return undefined;
    }

    line.style.transition = 'none';
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
    if (areaRef.current) {
      areaRef.current.style.transition = 'none';
      areaRef.current.style.opacity = '0';
    }

    // Force layout so the browser commits the "hidden" state before animating.
    void line.getBoundingClientRect();

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        line.style.transition = `stroke-dashoffset ${LINE_DRAW_MS}ms ${LINE_DRAW_EASING}`;
        line.style.strokeDashoffset = '0';
        if (areaRef.current) {
          areaRef.current.style.transition = `opacity ${LINE_DRAW_MS}ms ${LINE_DRAW_EASING}`;
          areaRef.current.style.opacity = '1';
        }
        drawnFingerprintRef.current = dataFingerprint;
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [linePath, dataFingerprint, reduceMotion, seriesKey]);

  return (
    <g>
      {areaPath ? (
        <path
          ref={areaRef}
          d={areaPath}
          fill={isSparkline ? undefined : `url(#${gradientId})`}
          className={
            isSparkline
              ? `admin-revenue-chart-area admin-chart-area--draw ${extraClass}`
              : `admin-chart-area admin-chart-area--draw ${extraClass}`
          }
          stroke="none"
          style={reduceMotion ? undefined : { opacity: 0 }}
        />
      ) : null}
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
      {activeDot ? (
        <circle
          cx={activeDot.cx}
          cy={activeDot.cy}
          r="5"
          fill={color}
          className="admin-chart-active-dot"
        />
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
}: AdminLineChartProps) {
  const isSparkline = variant === 'sparkline';
  const useCurve = curve ?? (isSparkline ? 'linear' : 'smooth');
  const gradientId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 900, height: isSparkline ? 88 : 320 });
  const [tooltip, setTooltip] = useState<TooltipState>(null);

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

  const estimateYLabelWidth = (label: string) => Math.max(36, label.length * 7 + 12);

  const xTickLabels = sortedLabels.filter((label, i) => {
    if (label === 'start' || label === 'end') return false;
    return (
      i % Math.max(1, Math.ceil(sortedLabels.length / 6)) === 0 ||
      i === sortedLabels.length - 1
    );
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

  const updateTooltipFromClientX = (clientX: number) => {
    if (isEmpty || sortedLabels.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const svgMouseX = (mouseX / rect.width) * svgW;
    const idx = snapIndex(svgMouseX, padding.left, innerW, sortedLabels.length);
    const label = sortedLabels[idx];
    const crosshairX = xPos(label);
    const entries = safeSeries.map((s) => {
      const pt = s.points.find((p) => p.label === label);
      return { key: s.key, name: s.name, value: pt?.value ?? 0, color: getColor(s.key) };
    });
    setTooltip({ label, entries, crosshairX, activeIndex: idx });
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
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          );
        })}
      </defs>

      {!isSparkline &&
        yTicks.map((tick) => {
          if ((contentInsetTop ?? 0) > 0 && tick === yMax) return null;
          const label = fmtAxisValue(tick);
          const labelWidth = estimateYLabelWidth(label);
          const labelY = yPos(tick);
          return (
            <g key={`ytick-${tick}`}>
              <line
                x1={padding.left}
                y1={labelY}
                x2={svgW - padding.right}
                y2={labelY}
                className="admin-sales-grid-line"
              />
              <g className="admin-chart-y-label" transform={`translate(${padding.left + 4}, ${labelY - 9})`}>
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
            textAnchor="middle"
            className="admin-sales-axis-label"
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
        tabIndex={onExpand ? 0 : undefined}
        onKeyDown={
          onExpand
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onExpand();
                }
              }
            : undefined
        }
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
      </div>
    </div>
  );
}
