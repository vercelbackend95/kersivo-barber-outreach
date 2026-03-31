import React, { useEffect, useRef, useState } from 'react';

export type AdminLineChartPoint = { label: string; value: number };

export type AdminLineChartSeries = {
  key: string;
  name: string;
  points: AdminLineChartPoint[];
};

type TooltipState = {
  label: string;
  entries: Array<{ key: string; name: string; value: number; color: string }>;
  containerX: number;
  containerY: number;
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
};

const TICK_COUNT = 4;
const TOOLTIP_MAX_W = 188;

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
  const d = new Date(`${label}T00:00:00`);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return label;
}

function formatXAxisLabel(label: string): string {
  const d = new Date(`${label}T00:00:00`);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  }
  return label;
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
}: AdminLineChartProps) {
  const isSparkline = variant === 'sparkline';
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

  const padding = isSparkline
    ? { top: 8, right: 8, bottom: 8, left: 8 }
    : { top: 20, right: 20, bottom: 36, left: 54 };

  const svgW = dims.width;
  const svgH = dims.height;
  const innerW = svgW - padding.left - padding.right;
  const innerH = svgH - padding.top - padding.bottom;

  const safeSeries = series.filter((s) => s.points.length > 0);

  const allLabels = Array.from(
    new Set(safeSeries.flatMap((s) => s.points.map((p) => p.label))),
  ).sort((a, b) => a.localeCompare(b));

  const allValues = safeSeries.flatMap((s) => s.points.map((p) => p.value));
  const rawMax = allValues.length > 0 ? Math.max(0, ...allValues) : 0;
  const rawMin = allValues.length > 0 ? Math.min(0, ...allValues) : 0;
  const yMax = Math.max(rawMax, metric === 'currency' ? 100 : 1);
  const yMin = Math.min(0, rawMin);
  const yRange = Math.max(1, yMax - yMin);

  const isEmpty = safeSeries.length === 0 || allValues.every((v) => v === 0);

  const xPos = (label: string): number => {
    if (allLabels.length <= 1) return padding.left + innerW / 2;
    const idx = allLabels.indexOf(label);
    if (idx < 0) return padding.left;
    return padding.left + (idx / (allLabels.length - 1)) * innerW;
  };

  const yPos = (value: number): number =>
    padding.top + (1 - (value - yMin) / yRange) * innerH;

  const fmtTooltipValue = formatValue ?? ((v: number) => defaultFormatValue(v, metric));
  const fmtAxisValue = (v: number) => defaultFormatAxisValue(v, metric);
  const yAxisTitle = metric === 'currency' ? 'Value (GBP)' : 'Value';
  const xAxisTitle = 'Date';

  const yTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    yMin + (yRange / TICK_COUNT) * i,
  );

  const xTickLabels = allLabels.filter((label, i) => {
    if (label === 'start' || label === 'end') return false;
    return (
      i % Math.max(1, Math.ceil(allLabels.length / 6)) === 0 ||
      i === allLabels.length - 1
    );
  });

  const buildLinePath = (points: AdminLineChartPoint[]): string =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xPos(p.label)} ${yPos(p.value)}`)
      .join(' ');

  const buildAreaPath = (points: AdminLineChartPoint[]): string => {
    if (points.length === 0) return '';
    const baseline = yPos(yMin);
    const firstX = xPos(points[0].label);
    const lastX = xPos(points[points.length - 1].label);
    return `${buildLinePath(points)} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isEmpty || allLabels.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const svgMouseX = (mouseX / rect.width) * svgW;
    const rawIdx = ((svgMouseX - padding.left) / innerW) * (allLabels.length - 1);
    const idx = Math.max(0, Math.min(allLabels.length - 1, Math.round(rawIdx)));
    const label = allLabels[idx];
    const entries = safeSeries.map((s) => {
      const pt = s.points.find((p) => p.label === label);
      return { key: s.key, name: s.name, value: pt?.value ?? 0, color: getColor(s.key) };
    });
    setTooltip({ label, entries, containerX: mouseX, containerY: mouseY });
  };

  const handleMouseLeave = () => { setTooltip(null); };

  const svgNode = (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="none"
      className={isSparkline ? 'admin-revenue-chart-svg' : 'admin-sales-chart-svg'}
      aria-hidden="true"
    >
      {/* Y-axis grid lines and labels */}
      {!isSparkline &&
        yTicks.map((tick) => (
          <g key={`ytick-${tick}`}>
            <line
              x1={padding.left}
              y1={yPos(tick)}
              x2={svgW - padding.right}
              y2={yPos(tick)}
              className="admin-sales-grid-line"
            />
            <text
              x={padding.left - 8}
              y={yPos(tick) + 4}
              textAnchor="end"
              className="admin-sales-axis-label"
            >
              {fmtAxisValue(tick)}
            </text>
          </g>
        ))}

      {/* Sparkline baseline */}
      {isSparkline && (
        <line
          x1={padding.left}
          y1={yPos(yMin)}
          x2={svgW - padding.right}
          y2={yPos(yMin)}
          className="admin-revenue-chart-axis"
        />
      )}

      {/* Empty state text (sparkline only) */}
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

      {/* Series paths */}
      {!isEmpty &&
        safeSeries.map((s) => {
          const linePath = buildLinePath(s.points);
          const extraClass = getPathClassName ? getPathClassName(s.key) : '';
          const color = getColor(s.key);
          const strokeWidth = getStrokeWidth ? getStrokeWidth(s.key) : 2;

          return (
            <g key={s.key}>
              {isSparkline && (
                <path
                  d={buildAreaPath(s.points)}
                  className={`admin-revenue-chart-area ${extraClass}`}
                  stroke="none"
                />
              )}
              <path
                d={linePath}
                fill="none"
                stroke={isSparkline ? undefined : color}
                strokeWidth={isSparkline ? undefined : strokeWidth}
                className={isSparkline ? `admin-revenue-chart-line ${extraClass}` : undefined}
              />
              {!isSparkline &&
                s.points.map((pt) => (
                  <circle
                    key={`${s.key}-${pt.label}`}
                    cx={xPos(pt.label)}
                    cy={yPos(pt.value)}
                    r="2.25"
                    fill={color}
                  />
                ))}
            </g>
          );
        })}

      {/* X-axis labels */}
      {!isSparkline &&
        xTickLabels.map((label) => (
          <text
            key={`x-${label}`}
            x={xPos(label)}
            y={svgH - 12}
            textAnchor="middle"
            className="admin-sales-axis-label"
          >
            {formatXAxisLabel(label)}
          </text>
        ))}

      {!isSparkline && (
        <>
          <text
            x={padding.left + innerW / 2}
            y={svgH - 2}
            textAnchor="middle"
            className="admin-sales-axis-title"
          >
            {xAxisTitle}
          </text>
          <text
            x={14}
            y={padding.top + innerH / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${padding.top + innerH / 2})`}
            className="admin-sales-axis-title"
          >
            {yAxisTitle}
          </text>
        </>
      )}
    </svg>
  );

  const tooltipNode = tooltip ? (
    <div
      className="admin-line-chart-tooltip"
      style={{
        left: Math.min(
          tooltip.containerX + 14,
          dims.width - TOOLTIP_MAX_W - 8,
        ),
        top: Math.max(4, tooltip.containerY - 60),
      }}
      aria-hidden="true"
    >
      <p className="admin-line-chart-tooltip-label">
        {formatTooltipDateLabel(tooltip.label)}
      </p>
      {tooltip.entries.map((e) => (
        <p key={e.key} className="admin-line-chart-tooltip-entry">
          <span
            className="admin-line-chart-tooltip-dot"
            style={{ background: e.color }}
          />
          <span className="admin-line-chart-tooltip-name">{e.name}</span>
          <span className="admin-line-chart-tooltip-value">
            {fmtTooltipValue(e.value)}
          </span>
        </p>
      ))}
    </div>
  ) : null;

  if (isSparkline) {
    return (
      <div
        ref={containerRef}
        className="admin-revenue-chart"
        role="img"
        aria-label={ariaLabel ?? 'Trend over selected period'}
        style={{ position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
        style={height ? { height } : undefined}
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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {svgNode}
        {tooltipNode}
        {emptyOverlay}
      </div>
    </div>
  );
}
