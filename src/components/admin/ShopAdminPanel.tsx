import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OrdersDataTable22 from './OrdersDataTable22';
import { SettingsGearIcon } from './SettingsGearIcon';
type ShopTab = 'products' | 'orders' | 'sales';
type SalesRangePreset = '7' | '30' | '90' | 'custom';

type SalesMetric = 'revenue' | 'units';

type Product = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  updatedAt: string;
};
type OrderListItem = {
  id: string;
  customerEmail: string;
  status: 'PAID' | 'COLLECTED';
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  _count: { items: number };
};

type OrderDetail = {
  id: string;
  customerEmail: string;
  status: 'PAID' | 'COLLECTED';
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  collectedAt: string | null;
  items: Array<{
    id: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};
type SalesResponse = {
  range: { from: string; to: string; tz: string };
  kpis: {
    revenuePence: number;
    ordersCount: number;
    avgOrderValuePence: number;
    bestProduct?: { productId: string; name: string; revenuePence: number; units: number };
  };
  series: {
    overall?: Array<{ date: string; revenuePence: number; units: number }>;
    products?: Array<{
      productId: string;
      name: string;
      points: Array<{ date: string; revenuePence: number; units: number }>;
    }>;
  };
  leaderboard: Array<{ productId: string; name: string; units: number; revenuePence: number }>;
};


type ProductFormState = {
  id?: string;
  name: string;
  description: string;
  priceGbp: string;
  imageUrl: string;
  active: boolean;
  featured: boolean;
  sortOrder: number;
};
type ProductFilter = 'all' | 'active' | 'inactive' | 'featured';
type ProductSortMode = 'manual' | 'newest' | 'price' | 'name';



type SalesChartSeries = {
  key: string;
  name: string;
  points: Array<{ date: string; revenuePence: number; units: number }>;
};

type SalesSeriesPill = {
  key: string;
  label: string;
  color: string;
  isOverall?: boolean;
};

type SalesChartErrorBoundaryProps = {
  children: React.ReactNode;
};

type SalesChartErrorBoundaryState = {
  hasError: boolean;
};
const MAX_SELECTED_PRODUCTS = 5;
const SALES_SELECTION_LIMIT_MESSAGE = 'Max 5 products can be compared.';


function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY;
    const { body } = document;
    const previousStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      const restoredScrollY = Number.parseInt(body.style.top || '0', 10) * -1;
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.left = previousStyles.left;
      body.style.right = previousStyles.right;
      body.style.width = previousStyles.width;
      body.style.overflow = previousStyles.overflow;
      window.scrollTo(0, Number.isFinite(restoredScrollY) ? restoredScrollY : scrollY);
    };
  }, [isLocked]);
}



const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  priceGbp: '',
  imageUrl: '',
  active: true,
  featured: false,
  sortOrder: 0
};
const SORT_ORDER_MIN = 0;
const SORT_ORDER_MAX = 9999;

const PRODUCT_SLOT_COLORS = ['#E6EAF0', '#7DD3FC', '#5EEAD4', '#FBBF24', '#C4B5FD'];
const OVERALL_COLOR = '#E11D2E';

const DEFAULT_PRODUCT_SERIES_COLOR = 'var(--border)';



function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pricePence / 100);
}

function penceFromGbp(value: string): number {
  const normalized = value.replace(/,/g, '.').trim();
  if (!normalized) return 0;
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}
function getCurrentYmdInLondon(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getRangeDates(preset: Exclude<SalesRangePreset, 'custom'>): { from: string; to: string } {
  const days = Number(preset);
  const today = new Date();
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);

  const fromBase = new Date();
  fromBase.setUTCDate(fromBase.getUTCDate() - (days - 1));
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fromBase);

  return { from, to };
}
class SalesChartErrorBoundary extends React.Component<SalesChartErrorBoundaryProps, SalesChartErrorBoundaryState> {
  state: SalesChartErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SalesChartErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Sales chart rendering error:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-inline-error" role="alert">
          <p>Sales chart failed to load. Please refresh.</p>
          <button type="button" className="btn btn--secondary" onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}


type MiniLineChartProps = {
  series: SalesChartSeries[];
  metric: SalesMetric;
  getSeriesColor: (seriesKey: string) => string;
  getSeriesStrokeWidth?: (seriesKey: string) => number;

  height?: string;
  onExpand?: () => void;
  isFullscreen?: boolean;
  useResponsiveResize?: boolean;
};

type SeriesPillsProps = {
  seriesList: SalesSeriesPill[];
  onRemove: (seriesKey: string) => void;
  maxHintVisible: boolean;
  emptySelectionHintVisible: boolean;
};
type ProductStatusSwitchProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onLabel: string;
  offLabel: string;
  tone: 'active' | 'featured';
  onChange: (nextValue: boolean) => void;
};

type EditFooterActionsProps = {
  canDelete: boolean;
  disableDelete: boolean;
  saving: boolean;
  canSave: boolean;
  savedNotice: string | null;
  onCancel: () => void;
  onDelete: () => void;
};


function SeriesPills({
  seriesList,
 onRemove,
  maxHintVisible,

  emptySelectionHintVisible

}: SeriesPillsProps) {
  return (
    <div className="admin-sales-series-pills-wrap" aria-live="polite">
      <div className="admin-sales-series-pills" role="list" aria-label="Chart series legend">
        {seriesList.map((series) => (
          <span
            key={series.key}
            className="admin-sales-series-pill admin-sales-series-pill--active"
            role="listitem"
          >
            <span className="admin-sales-series-pill__swatch" style={{ background: series.color }} aria-hidden="true" />
            <span>{series.label}</span>
            {!series.isOverall ? (
              <button
                type="button"
                className="admin-sales-series-pill__remove"
                onClick={() => onRemove(series.key)}
                aria-label={`Remove ${series.label}`}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}

      </div>
      {maxHintVisible ? <p className="admin-sales-series-hint">{SALES_SELECTION_LIMIT_MESSAGE}</p> : null}
      {emptySelectionHintVisible ? <p className="admin-sales-series-hint">Select a product to display data</p> : null}
    </div>
  );
}
function ProductStatusSwitch({
  label,
  checked,
  disabled = false,
  onLabel,
  offLabel,
  tone,
  onChange
}: ProductStatusSwitchProps) {
  const statusLabel = checked ? onLabel : offLabel;
  return (
    <div className="admin-product-switch" data-tone={tone}>
      <span className="admin-product-switch__copy">
        <span className="admin-product-switch__label">{label}</span>
        <span className="admin-product-switch__status">
          <span className={`admin-product-switch__dot ${checked ? 'is-on' : ''}`} aria-hidden="true" />
          {statusLabel}
        </span>
      </span>
      <button
        type="button"
        className={`admin-product-switch__control ${checked ? 'is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${statusLabel}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="admin-product-switch__track" aria-hidden="true">
          <span className="admin-product-switch__thumb" />
        </span>
      </button>
    </div>
  );
}
function EditFooterActions({
  canDelete,
  disableDelete,
  saving,
  canSave,
  savedNotice,
  onCancel,
  onDelete
}: EditFooterActionsProps) {
  return (
    <div className="admin-product-sheet-footer" aria-live="polite">
      <button type="submit" className="btn btn--primary" disabled={saving || !canSave}>{saving ? 'Saving...' : 'Save product'}</button>
      <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>
      {canDelete ? (
        <button
          type="button"
          className="btn btn--destructive"
          onClick={onDelete}
          disabled={disableDelete}
        >
          Delete
        </button>
      ) : null}
      {savedNotice ? <p className="admin-product-sheet-feedback">{savedNotice}</p> : null}
    </div>
  );
}



function useProductSeriesSelection(allSalesSeries: SalesChartSeries[]) {
  const [enabledProductIds, setEnabledProductIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const validProductIds = new Set(allSalesSeries.filter((series) => series.key !== 'overall').map((series) => series.key));
    setEnabledProductIds((previous) => {
      const next = new Set(Array.from(previous).filter((seriesId) => validProductIds.has(seriesId)));
      if (next.size === previous.size) return previous;
      return next;

    });
  }, [allSalesSeries]);

  const setLimitError = () => {
    setErrorMessage(SALES_SELECTION_LIMIT_MESSAGE);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setErrorMessage(null);
    }, 2000);
  };

  const clearLimitError = () => {
    setErrorMessage(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const addProduct = (seriesKey: string) => {
    setEnabledProductIds((previous) => {
      if (previous.has(seriesKey)) {
        return previous;

      }

      if (previous.size >= MAX_SELECTED_PRODUCTS) {
        setLimitError();
        return previous;

        
      }

      clearLimitError();
      const next = new Set(previous);
      next.add(seriesKey);
      return next;

    });
  };

  const removeProduct = (seriesKey: string) => {
    setEnabledProductIds((previous) => {
      if (!previous.has(seriesKey)) return previous;
      const next = new Set(previous);
      next.delete(seriesKey);
      clearLimitError();
      return next;

    });
  };

  const selectedProductIds = Array.from(enabledProductIds);
  const activeSeriesKeys = allSalesSeries.some((series) => series.key === 'overall')
    ? ['overall', ...selectedProductIds]
    : selectedProductIds;



  return {
        selectedProductIds,
    activeSeriesKeys,
    addProduct,
    removeProduct,
    errorMessage
  };
}


function MiniLineChart({
  series,
  metric,
  getSeriesColor,
  getSeriesStrokeWidth,

  height,
  onExpand,
  isFullscreen = false,
  useResponsiveResize = false
}: MiniLineChartProps) {
    const isEmptySelection = series.length === 0;
  const chartCanvasRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 320 });

  useEffect(() => {
    if (!useResponsiveResize || !chartCanvasRef.current) return undefined;

    const element = chartCanvasRef.current;
    const updateDimensions = () => {
      const nextWidth = Math.max(320, Math.round(element.clientWidth));
      const nextHeight = Math.max(220, Math.round(element.clientHeight));
      setDimensions((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateDimensions();

    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      updateDimensions();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [useResponsiveResize]);



  const width = dimensions.width;
  const chartHeight = dimensions.height;

  const padding = { top: 20, right: 20, bottom: 36, left: 54 };
  const safeSeries = series
    .map((line) => ({ ...line, points: line.points ?? [] }))
    .filter((line) => line.points.length > 0);

  const fallbackDates = ['start', 'end'];
  const fallbackSeries: SalesChartSeries = {
    key: '__empty__',
    name: 'No data',
    points: fallbackDates.map((date) => ({ date, revenuePence: 0, units: 0 }))
  };
  const seriesForChart = safeSeries.length > 0 ? safeSeries : [fallbackSeries];
  const allPoints = seriesForChart.flatMap((line) => line.points);


  const allDates = Array.from(new Set(allPoints.map((point) => point.date))).sort((a, b) => a.localeCompare(b));
  const values = allPoints.map((point) => (metric === 'revenue' ? point.revenuePence : point.units));
  const maxValue = values.length > 0 ? Math.max(0, ...values) : 0;
  const yMax = Math.max(maxValue, metric === 'revenue' ? 100 : 1);


  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const xPosition = (date: string): number => {
    const index = allDates.indexOf(date);
    if (index <= 0 || allDates.length <= 1) return padding.left;
    return padding.left + (index / (allDates.length - 1)) * innerWidth;
  };

  const yPosition = (value: number): number => padding.top + (1 - value / yMax) * innerHeight;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => (yMax / ticks) * index);
  const formatAxisValue = (value: number): string => {
    if (metric === 'revenue') {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
      }).format(value / 100);
    }
    return `${Math.round(value)}`;
  };

  const formatTooltipValue = (value: number): string => (metric === 'revenue' ? formatPrice(value) : `${Math.round(value)} units`);


  return (
    <div className={`admin-sales-chart-inner ${isFullscreen ? 'admin-sales-chart-inner--fullscreen' : ''}`}>
      <div
        ref={chartCanvasRef}
        className={`admin-sales-chart-canvas ${onExpand ? 'admin-sales-chart-canvas--clickable' : ''}`}
        style={height ? { height } : undefined}
        onClick={onExpand}
        role={onExpand ? 'button' : undefined}
        tabIndex={onExpand ? 0 : undefined}
        onKeyDown={onExpand ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onExpand();
          }
        } : undefined}
        aria-label={onExpand ? 'Tap to expand sales chart' : undefined}

      >
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          preserveAspectRatio="none"
          className="admin-sales-chart-svg"
          role="img"
          aria-label={`Sales ${metric === 'revenue' ? 'revenue' : 'units'} chart`}
        >

        {yTicks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line x1={padding.left} y1={yPosition(tick)} x2={width - padding.right} y2={yPosition(tick)} className="admin-sales-grid-line" />
            <text x={padding.left - 8} y={yPosition(tick) + 4} textAnchor="end" className="admin-sales-axis-label">{formatAxisValue(tick)}</text>
          </g>
        ))}

        {seriesForChart.map((line) => {
          const path = line.points
            .map((point, pointIndex) => {
              const value = metric === 'revenue' ? point.revenuePence : point.units;
              return `${pointIndex === 0 ? 'M' : 'L'} ${xPosition(point.date)} ${yPosition(value)}`;
            })

          .join(' ');

          return (
            <g key={line.key}>
              <path
                d={path}
                fill="none"
                stroke={getSeriesColor(line.key)}
                strokeWidth={getSeriesStrokeWidth ? getSeriesStrokeWidth(line.key) : 2}
              />

              {line.key === '__empty__' ? null : line.points.map((point) => {
                const value = metric === 'revenue' ? point.revenuePence : point.units;
                return (
                  <circle key={`${line.key}-${point.date}`} cx={xPosition(point.date)} cy={yPosition(value)} r="2.25" fill={getSeriesColor(line.key)}>
                    <title>{`${new Date(`${point.date}T00:00:00`).toLocaleDateString('en-GB')} · ${line.name}: ${formatTooltipValue(value)}`}</title>
                  </circle>
                );
              })}

            </g>
          );
        })}

        {allDates.filter((date, index) => date !== 'start' && date !== 'end' && (index % Math.max(1, Math.ceil(allDates.length / 6)) === 0 || index === allDates.length - 1)).map((date) => (
          <text key={`x-${date}`} x={xPosition(date)} y={chartHeight - 12} textAnchor="middle" className="admin-sales-axis-label">
            {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
                </svg>
                        {isEmptySelection ? (
          <div className="admin-sales-chart-overlay" aria-live="polite">
            <p>No products selected</p>
            <p>Enable a product below to display data.</p>
          </div>
        ) : null}

      </div>



    </div>
  );
}


type ShopAdminPanelProps = {
  initialTab?: ShopTab;
};

export default function ShopAdminPanel({ initialTab = 'products' }: ShopAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>(initialTab);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderDetailsById, setOrderDetailsById] = useState<Record<string, OrderDetail>>({});
  const [orderDetailsLoadingId, setOrderDetailsLoadingId] = useState<string | null>(null);

  const [ordersUnauthorized, setOrdersUnauthorized] = useState(false);

  const [salesPreset, setSalesPreset] = useState<SalesRangePreset>('30');
  const [salesFrom, setSalesFrom] = useState(() => getRangeDates('30').from);
  const [salesTo, setSalesTo] = useState(() => getCurrentYmdInLondon());
  const [salesMetric, setSalesMetric] = useState<SalesMetric>('revenue');
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [isMobileSalesView, setIsMobileSalesView] = useState(false);
  const [isSalesChartExpanded, setIsSalesChartExpanded] = useState(false);
  const [expandedProductSearch, setExpandedProductSearch] = useState('');
    useBodyScrollLock(formOpen || (isMobileSalesView && isSalesChartExpanded));


    const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productSortMode, setProductSortMode] = useState<ProductSortMode>('manual');
  const [manualOrderIds, setManualOrderIds] = useState<string[]>([]);
  const [productSavingById, setProductSavingById] = useState<Record<string, boolean>>({});
  const [productStatusById, setProductStatusById] = useState<Record<string, string>>({});
  const [formInitial, setFormInitial] = useState<ProductFormState>(EMPTY_FORM);
  const [footerFeedback, setFooterFeedback] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );
  

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 47.99rem)');
    const handleChange = () => {
      setIsMobileSalesView(mediaQuery.matches);
      if (!mediaQuery.matches) setIsSalesChartExpanded(false);
    };
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);


  const manualProducts = useMemo(() => {
    const validIds = manualOrderIds.filter((id) => productMap.has(id));
    const missingIds = sortedProducts.map((product) => product.id).filter((id) => !validIds.includes(id));
    return [...validIds, ...missingIds]
      .map((id) => productMap.get(id))
      .filter((product): product is Product => Boolean(product));
  }, [manualOrderIds, productMap, sortedProducts]);

  const baseProducts = useMemo(() => {
    if (productSortMode === 'manual') return manualProducts;
    const source = [...sortedProducts];
    if (productSortMode === 'newest') {
      return source.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }
    if (productSortMode === 'price') {
      return source.sort((a, b) => b.pricePence - a.pricePence || a.name.localeCompare(b.name));
    }
    return source.sort((a, b) => a.name.localeCompare(b.name));
  }, [manualProducts, productSortMode, sortedProducts]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return baseProducts.filter((product) => {
      if (productFilter === 'active' && !product.active) return false;
      if (productFilter === 'inactive' && product.active) return false;
      if (productFilter === 'featured' && !product.featured) return false;
      if (!query) return true;
      return product.name.toLowerCase().includes(query) || (product.description || '').toLowerCase().includes(query);
    });
  }, [baseProducts, productFilter, productSearch]);

  const featuredCount = useMemo(() => products.filter((product) => product.featured).length, [products]);
  const canReorder = productSortMode === 'manual' && productFilter === 'all' && productSearch.trim().length === 0;
  const defaultSortOrder = useMemo(() => Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, products.length)), [products.length]);
  const maxFormSortOrder = useMemo(() => {
    const highestTakenPosition = Math.max(SORT_ORDER_MIN, products.length - 1);
    if (form.id) return highestTakenPosition;
    return Math.min(SORT_ORDER_MAX, highestTakenPosition + 1);
  }, [form.id, products.length]);
  const displayListPosition = useMemo(() => Math.max(1, form.sortOrder + 1), [form.sortOrder]);
  const isFormAtTop = form.sortOrder <= SORT_ORDER_MIN;
  const isFormAtBottom = form.sortOrder >= maxFormSortOrder;

  const formDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(formInitial), [form, formInitial]);
  const formPricePence = useMemo(() => penceFromGbp(form.priceGbp), [form.priceGbp]);
  const formValid = useMemo(() => form.name.trim().length > 0 && formPricePence > 0, [form.name, formPricePence]);




  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    setManualOrderIds(sortedProducts.map((product) => product.id));
  }, [sortedProducts]);

  useEffect(() => {
    if (!formOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetForm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen]);
  
  useEffect(() => {
    if (!footerFeedback) return;
    const timeoutId = window.setTimeout(() => setFooterFeedback(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [footerFeedback]);


    const activeSectionLabel = useMemo(() => {
    if (activeTab === 'orders') return 'Orders';
    if (activeTab === 'sales') return 'Sales';
    return 'Products';
  }, [activeTab]);



  const allSalesSeries = useMemo(() => {
    if (!salesData) return [] as SalesChartSeries[];

    const lines: SalesChartSeries[] = [];

    if (salesData.series.overall) {
      lines.push({ key: 'overall', name: 'Overall', points: salesData.series.overall });
    }

    for (const productSeries of salesData.series.products ?? []) {
      lines.push({
        key: productSeries.productId,
        name: productSeries.name,
        points: productSeries.points.map((point) => ({ date: point.date, revenuePence: point.revenuePence, units: point.units }))
      });
    }

    return lines;
  }, [salesData]);

  const {
    selectedProductIds,
    activeSeriesKeys,
    addProduct: addSeriesSelection,

    removeProduct: removeSeriesSelection,
    errorMessage: selectionLimitMessage
  } = useProductSeriesSelection(allSalesSeries);
  const getSlotColor = useCallback((productId: string): string => {
    const slotIndex = selectedProductIds.indexOf(productId);
    return slotIndex >= 0 ? PRODUCT_SLOT_COLORS[slotIndex] : PRODUCT_SLOT_COLORS[0];
  }, [selectedProductIds]);

  const getSeriesColor = useCallback((seriesKey: string): string => {
    if (seriesKey === 'overall') return OVERALL_COLOR;
    if (seriesKey === '__empty__') return DEFAULT_PRODUCT_SERIES_COLOR;
    return getSlotColor(seriesKey);
  }, [getSlotColor]);

  const getSeriesStrokeWidth = useCallback((seriesKey: string): number => {
    if (seriesKey === 'overall' || seriesKey === '__empty__') return 2;
    const slotIndex = selectedProductIds.indexOf(seriesKey);
    if (slotIndex === 0) return 3;
    return 2;
  }, [selectedProductIds]);


  const seriesPills = useMemo(
    () => allSalesSeries.map((series) => ({
      key: series.key,
      label: series.name,
      color: getSeriesColor(series.key),
      isOverall: series.key === 'overall'
    })),
    [allSalesSeries, getSeriesColor]
  );


  const chartSeries = useMemo(() => allSalesSeries.filter((series) => activeSeriesKeys.includes(series.key)), [activeSeriesKeys, allSalesSeries]);
  const legendSeries = useMemo(() => seriesPills.filter((series) => activeSeriesKeys.includes(series.key)), [activeSeriesKeys, seriesPills]);
  const filteredExpandableProducts = useMemo(() => {
    const normalizedQuery = expandedProductSearch.trim().toLowerCase();
    return seriesPills.filter((series) => {
      if (activeSeriesKeys.includes(series.key)) return false;
      if (!normalizedQuery) return true;
      return series.label.toLowerCase().includes(normalizedQuery);
    });
  }, [activeSeriesKeys, expandedProductSearch, seriesPills]);

  const handleAddSeriesSelection = (seriesKey: string) => {
    addSeriesSelection(seriesKey);
    setExpandedProductSearch('');
  };





  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/shop/products', { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not fetch products.');
      setProducts(payload.products as Product[]);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch products.');
    } finally {
      setLoading(false);
    }
  }
  async function fetchOrders() {
    setOrdersLoading(true);
    setError(null);
    setOrdersUnauthorized(false);
    try {
      const response = await fetch('/api/admin/shop/orders', { credentials: 'include' });
      const payload = await response.json();
            if (response.status === 401) {
        setOrders([]);
        setExpandedOrderId(null);
        setOrderDetailsById({});

        setOrdersUnauthorized(true);
        return;
      }

      if (!response.ok) throw new Error(payload.error || 'Could not fetch orders.');
      setOrders(payload.orders as OrderListItem[]);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch orders.');
    } finally {
      setOrdersLoading(false);
    }
  }

  async function fetchOrderDetails(orderId: string) {
    setError(null);
    setOrderDetailsLoadingId(orderId);
    try {
     const response = await fetch(`/api/admin/shop/orders/${orderId}`, { credentials: 'include' });
      const payload = await response.json();
            if (response.status === 401) {
        setExpandedOrderId(null);
        setOrdersUnauthorized(true);
        return;
      }

      if (!response.ok) throw new Error(payload.error || 'Could not fetch order details.');
      const detail = payload.order as OrderDetail;
      setOrderDetailsById((previous) => ({ ...previous, [detail.id]: detail }));

    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch order details.');
          } finally {
      setOrderDetailsLoadingId((previous) => (previous === orderId ? null : previous));

    }
  }

  async function fetchSales(options?: { explicitFrom?: string; explicitTo?: string; explicitPreset?: SalesRangePreset }) {
    setSalesLoading(true);
    setSalesError(null);

    const preset = options?.explicitPreset ?? salesPreset;
    const from = options?.explicitFrom ?? salesFrom;
    const to = options?.explicitTo ?? salesTo;

    const query = new URLSearchParams();
    if (preset === 'custom') {
      query.set('from', from);
      query.set('to', to);
    } else {
      query.set('range', preset);
    }

    try {
      const response = await fetch(`/api/admin/shop/sales?${query.toString()}`, { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not fetch sales analytics.');
      setSalesData(payload as SalesResponse);
    } catch (fetchError) {
      setSalesError(fetchError instanceof Error ? fetchError.message : 'Could not fetch sales analytics.');
    } finally {
      setSalesLoading(false);
    }
  }


  useEffect(() => {
    void fetchProducts();
  }, []);
  useEffect(() => {
    if (activeTab === 'orders') {
      void fetchOrders();
    }
        if (activeTab === 'sales') {
      void fetchSales();
    }

  }, [activeTab]);
  useEffect(() => {
    if (activeTab !== 'sales') return;
    void fetchSales();
  }, [activeTab, salesPreset, salesFrom, salesTo]);



  useEffect(() => {
    if (activeTab !== 'orders') return;
    const intervalId = window.setInterval(() => {
      void fetchOrders();
      if (expandedOrderId) {
        void fetchOrderDetails(expandedOrderId);

      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, expandedOrderId]);


  function resetForm() {
    setForm(EMPTY_FORM);
        setFormInitial(EMPTY_FORM);
            setFooterFeedback(null);
    setDeleteConfirmOpen(false);

    setFormOpen(false);
  }

  function startCreate() {
    const nextForm = {
      ...EMPTY_FORM,
      sortOrder: productSortMode === 'manual' ? defaultSortOrder : EMPTY_FORM.sortOrder
    };
    setForm(nextForm);
        setFormInitial(nextForm);

    setFormOpen(true);
    setError(null);
    setSuccess(null);
        setFooterFeedback(null);
  }

  function startEdit(product: Product) {
        const normalizedSortOrder = Number.isFinite(product.sortOrder)
      ? Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, product.sortOrder))
      : defaultSortOrder;

    const nextForm = {
      id: product.id,
      name: product.name,
      description: product.description || '',
      priceGbp: (product.pricePence / 100).toFixed(2),
      imageUrl: product.imageUrl || '',
      active: product.active,
      featured: product.featured,
      sortOrder: normalizedSortOrder
          };
    setForm(nextForm);
    setFormInitial(nextForm);

    setFormOpen(true);
    setError(null);
    setSuccess(null);
        setFooterFeedback(null);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    const pricePence = penceFromGbp(form.priceGbp);
    if (pricePence <= 0) {
      setError('Price must be greater than £0.00.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = form.id ? '/api/admin/shop/products/update' : '/api/admin/shop/products/create';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: trimmedName,
          description: form.description.trim(),
          pricePence,
          imageUrl: form.imageUrl.trim(),
          active: form.featured ? true : form.active,
          featured: form.active ? form.featured : false,

          sortOrder: Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, form.sortOrder))
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save product.');

      await fetchProducts();
      setSuccess(form.id ? 'Product updated.' : 'Product created.');
      setFooterFeedback('Saved');
      setFormInitial(form);

    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  }

  async function patchProductFlags(productId: string, patch: { active?: boolean; featured?: boolean }) {
    const existing = products.find((product) => product.id === productId);
    if (!existing) return;

    const nextActive = patch.active ?? existing.active;
    const nextFeatured = patch.featured ?? existing.featured;
    const normalized = {
      active: nextFeatured ? true : nextActive,
      featured: nextActive ? nextFeatured : false
    };

    const previousProducts = products;
    setProductSavingById((previous) => ({ ...previous, [productId]: true }));
    setProductStatusById((previous) => ({ ...previous, [productId]: 'Saving…' }));
    setProducts((previous) => previous.map((product) => (
      product.id === productId ? { ...product, active: normalized.active, featured: normalized.featured } : product
    )));


    try {
      const response = await fetch(`/api/admin/shop/products/${productId}`, {
        method: 'PATCH',

        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to update product.');
      setProducts((previous) => previous.map((product) => (product.id === productId ? payload.product as Product : product)));
      setProductStatusById((previous) => ({ ...previous, [productId]: 'Saved' }));
      window.setTimeout(() => {
        setProductStatusById((previous) => {
          const next = { ...previous };
          delete next[productId];
          return next;
        });
      }, 900);

    } catch (toggleError) {
            setProducts(previousProducts);
      setProductStatusById((previous) => ({ ...previous, [productId]: '' }));

      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update product.');
          } finally {
      setProductSavingById((previous) => ({ ...previous, [productId]: false }));

    }
  }

  async function disableProduct(productId: string) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/shop/products/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to delete product.');
      await fetchProducts();
      setSuccess('Product deleted.');
      resetForm();

    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete product.');
    }
  }
  
  async function saveManualOrder(orderedIds: string[]) {
    if (!canReorder) return;

    if (orderedIds.length === 0) return;

    const previous = manualOrderIds;

    setManualOrderIds(orderedIds);
    setProducts((previousProducts) => {
      const orderLookup = new Map(orderedIds.map((id, index) => [id, index]));
      return [...previousProducts].sort((a, b) => (orderLookup.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderLookup.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    });


    try {
      const response = await fetch('/api/admin/shop/products/reorder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save order.');
      if (Array.isArray(payload.products)) {
        setProducts(payload.products as Product[]);
      }
      setSuccess('Order updated.');
    } catch (reorderError) {
      setManualOrderIds(previous);
            setProducts((previousProducts) => {
        const orderLookup = new Map(previous.map((id, index) => [id, index]));
        return [...previousProducts].sort((a, b) => (orderLookup.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderLookup.get(b.id) ?? Number.MAX_SAFE_INTEGER));
      });

      setError(reorderError instanceof Error ? reorderError.message : 'Unable to save order.');
    }
  }
  function moveItemUp(index: number) {
    if (!canReorder || index <= 0) return;
    const orderedIds = manualProducts.map((product) => product.id);
    const nextOrderedIds = [...orderedIds];
    const [movedId] = nextOrderedIds.splice(index, 1);
    nextOrderedIds.splice(index - 1, 0, movedId);
    void saveManualOrder(nextOrderedIds);
  }

  function moveItemDown(index: number) {
    if (!canReorder || index < 0 || index >= manualProducts.length - 1) return;
    const orderedIds = manualProducts.map((product) => product.id);
    const nextOrderedIds = [...orderedIds];
    const [movedId] = nextOrderedIds.splice(index, 1);
    nextOrderedIds.splice(index + 1, 0, movedId);
    void saveManualOrder(nextOrderedIds);
  }



  async function markCollected(orderId: string) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}/collect`, { method: 'POST', credentials: 'include' });
      const payload = await response.json();
      if (response.status === 401) {
        setOrdersUnauthorized(true);
        setExpandedOrderId(null);
        return;
      }

      if (!response.ok) throw new Error(payload.error || 'Unable to mark order as collected.');
      await fetchOrders();
      await fetchOrderDetails(orderId);
      setSuccess('Order marked as collected.');
    } catch (collectError) {
      setError(collectError instanceof Error ? collectError.message : 'Unable to mark order as collected.');
    }
  }
  function toggleOrderExpand(orderId: string) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(orderId);
    if (!orderDetailsById[orderId]) {
      void fetchOrderDetails(orderId);
    }
  }



  function applyPreset(nextPreset: Exclude<SalesRangePreset, 'custom'>) {
    const dates = getRangeDates(nextPreset);
    setSalesPreset(nextPreset);
    setSalesFrom(dates.from);
    setSalesTo(dates.to);
  }


  return (
    <section className="booking-shell" aria-live="polite">
      <h1>SHOP</h1>

      <p className="admin-shop-kicker muted">{activeSectionLabel}</p>

      {activeTab === 'products' && (
        <div className="admin-reports admin-products-panel">
          <div className="admin-products-toolbar-sticky">
            <div className="admin-products-toolbar">
              <div className="admin-products-toolbar-top">
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  type="search"
                  className="admin-products-search"
                  placeholder="Search products"
                  aria-label="Search products"
                />



              </div>
              <div className="admin-products-toolbar-row">
                <div className="admin-products-controls-row">
                  <div className="admin-products-filters" role="tablist" aria-label="Product filters">
                    {(['all', 'active', 'inactive', 'featured'] as ProductFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={`admin-filter-tab ${productFilter === filter ? 'admin-filter-tab--active' : ''}`}
                        onClick={() => setProductFilter(filter)}
                      >
                        {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'inactive' ? 'Inactive' : 'Featured'}
                      </button>
                    ))}
                  </div>
                  <select value={productSortMode} onChange={(event) => setProductSortMode(event.target.value as ProductSortMode)} className="admin-products-sort" aria-label="Sort products">
                    <option value="manual">Manual order</option>
                    <option value="newest">Newest</option>
                    <option value="price">Price</option>
                    <option value="name">Name</option>
                  </select>

                </div>


                <p className="admin-products-count muted">{filteredProducts.length} products • {featuredCount} featured</p>
              </div>
            </div>
          </div>

          {formOpen ? createPortal((
            <div className="admin-product-sheet-backdrop" onClick={resetForm}>
              <form className="admin-product-sheet" onSubmit={saveProduct} onClick={(event) => event.stopPropagation()}>
                <div className="admin-product-sheet-head">
                  <h3>{form.id ? 'Edit product' : 'Add product'}</h3>
                  <button type="button" className="btn btn--ghost" onClick={resetForm}>Close</button>
                </div>
                <p className="admin-product-unsaved muted">{formDirty ? 'Unsaved changes' : 'All changes saved'}</p>

                <label className="admin-product-field">Image URL
                  <input type="url" value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://..." />
                </label>
                <div className="admin-product-image-preview" aria-hidden="true">
                  {form.imageUrl.trim() ? <img src={form.imageUrl} alt="Preview" draggable={false} /> : <span>No image preview</span>}
                </div>

                <label className="admin-product-field">Name
                  <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>
                <label className="admin-product-field">Price (GBP)
                  <div className="admin-price-input-wrap"><span>£</span><input inputMode="decimal" value={form.priceGbp} onChange={(event) => setForm((prev) => ({ ...prev, priceGbp: event.target.value.replace(/[^0-9.,]/g, '') }))} required /></div>
                </label>
                <label className="admin-product-field">Description
                  <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} />
                </label>

                <div className="admin-product-switches">
                  <ProductStatusSwitch
                    label="Active"
                    checked={form.active}
                    onLabel="Active"
                    offLabel="Inactive"
                    tone="active"
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, active: nextValue, featured: nextValue ? prev.featured : false }))}
                  />
                  <ProductStatusSwitch
                    label="Featured"
                    checked={form.featured}
                    onLabel="Featured"
                    offLabel="Not featured"
                    tone="featured"
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, featured: nextValue, active: nextValue ? true : prev.active }))}
                  />
                  {productSortMode === 'manual' ? (
                    <div className="admin-product-sort-inline">
                      <div className="admin-product-sort-inline__copy">
                        <p className="admin-product-sort-inline__label">List position</p>
                        <p className="admin-product-sort-inline__helper muted">1 = first on the list</p>
                      </div>
                      <div className="admin-product-sort-inline__control" role="group" aria-label="List position controls">
                        <span className="admin-product-sort-inline__rank" aria-live="polite">#{displayListPosition}</span>
                        <button
                          type="button"
                          className="admin-product-sort-inline__stepper"
                          onClick={() => setForm((prev) => ({ ...prev, sortOrder: Math.max(SORT_ORDER_MIN, prev.sortOrder - 1) }))}
                          aria-label="Move up"
                          disabled={isFormAtTop}

                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="admin-product-sort-inline__stepper"
                          onClick={() => setForm((prev) => ({ ...prev, sortOrder: Math.min(maxFormSortOrder, prev.sortOrder + 1) }))}
                          aria-label="Move down"
                          disabled={isFormAtBottom}

                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ) : null}

                </div>
                <EditFooterActions
                  canDelete={Boolean(form.id)}
                  disableDelete={saving}
                  saving={saving}
                  canSave={formValid && formDirty}
                  savedNotice={footerFeedback}
                  onCancel={resetForm}
                  onDelete={() => setDeleteConfirmOpen(true)}
                />

              </form>
                            {deleteConfirmOpen && form.id ? (
                <div className="admin-product-delete-confirm-layer" role="presentation">
                  <button
                    type="button"
                    className="admin-product-delete-confirm-backdrop"
                    onClick={() => setDeleteConfirmOpen(false)}
                    aria-label="Close delete confirmation"
                  />
                  <div className="admin-product-delete-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
                    <h4 id="delete-product-title" className="admin-product-delete-confirm-title">Delete product?</h4>
                    <p className="admin-product-delete-confirm-body">This will permanently remove the product from the shop.</p>
                    <div className="admin-product-delete-confirm-actions">
                      <button type="button" className="btn btn--secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={saving}>Cancel</button>
                      <button
                        type="button"
                        className="btn btn--destructive"
                        onClick={() => {
                          if (!form.id) return;
                          void disableProduct(form.id);
                        }}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

            </div>

          ), document.body) : null}

          <div className="admin-products-scroll" role="region" aria-label="Products list">
            {error ? <p className="admin-inline-error">{error}</p> : null}
            {success ? <p className="admin-inline-success">{success}</p> : null}

            <div className="admin-products-cards">
              {filteredProducts.length === 0 ? (
                <article className="admin-product-card"><p>No products yet.</p></article>
                            ) : filteredProducts.map((product, index) => {
                const isSavingCard = Boolean(productSavingById[product.id]);
                              const isFirstItem = index === 0;
                const isLastItem = index === filteredProducts.length - 1;


                return (
                  <article
                    key={product.id}
                    className="admin-product-card"

                >
                  <div className="admin-product-card-main">
                    <div className="admin-product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" draggable={false} /> : <span>No image</span>}</div>
                    <div>
                      <h4>{product.name}</h4>
                      <p className="admin-product-price">{formatPrice(product.pricePence)}</p>
                      <p className="admin-product-meta muted">Updated {new Date(product.updatedAt).toLocaleString('en-GB')} • List position #{product.sortOrder + 1}</p>
                    </div>

                    <div className="admin-reorder-controls" role="group" aria-label={`${product.name} controls`}>
                                          <div className="admin-reorder-arrow-stack">
                        <button
                          type="button"
                          className="admin-reorder-btn"
                          aria-label={`Move ${product.name} up`}
                          disabled={productSortMode !== 'manual' || !canReorder || isFirstItem}
                          onClick={() => moveItemUp(index)}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="admin-reorder-btn"
                          aria-label={`Move ${product.name} down`}
                          disabled={productSortMode !== 'manual' || !canReorder || isLastItem}
                          onClick={() => moveItemDown(index)}
                        >
                          ▼
                        </button>
                      </div>

                      <button
                        type="button"
                        className="admin-reorder-btn admin-reorder-btn--settings"
                        aria-label={`Edit ${product.name}`}
                        onClick={() => startEdit(product)}
                      >
                        <SettingsGearIcon className="admin-control-icon" />
                      </button>
                    </div>

                  </div>

                  <div className="admin-product-switches admin-product-switches--card">
                    <ProductStatusSwitch
                      label="Active"
                      checked={product.active}
                      disabled={isSavingCard}
                      onLabel="Active"
                      offLabel="Inactive"
                      tone="active"
                      onChange={(nextValue) => void patchProductFlags(product.id, { active: nextValue })}
                    />
                    <ProductStatusSwitch
                      label="Featured"
                      checked={product.featured}
                      disabled={isSavingCard}
                      onLabel="Featured"
                      offLabel="Not featured"
                      tone="featured"
                      onChange={(nextValue) => void patchProductFlags(product.id, { featured: nextValue })}
                    />

                  </div>

                  <div className="admin-products-actions">

                    <span className="admin-product-saving muted">{isSavingCard ? 'Saving…' : (productStatusById[product.id] || '')}</span>
                  </div>
                </article>
                );
              })}
              <article className="admin-product-card admin-product-card--add">
                <button type="button" className="admin-product-add-btn" onClick={startCreate}>
                  <span className="admin-product-add-icon" aria-hidden="true">+</span>
                  <span>Add product</span>
                </button>
              </article>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="admin-reports admin-orders-panel">
          {error ? <p className="admin-inline-error">{error}</p> : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}
          <div className="admin-products-actions">
            <button type="button" className="btn btn--ghost" onClick={() => void fetchOrders()} disabled={ordersLoading}>{ordersLoading ? 'Refreshing...' : 'Refresh orders'}</button>
          </div>
          {ordersUnauthorized ? (


            <div className="admin-inline-error" role="alert">
              <p>Session expired — please log in again.</p>
              <a href="/admin" className="btn btn--secondary">Go to admin login</a>
            </div>
          ) : null}

          <OrdersDataTable22
            orders={orders}
            expandedOrderId={expandedOrderId}
            onToggleExpand={toggleOrderExpand}
            orderDetailsById={orderDetailsById}
            orderDetailsLoadingId={orderDetailsLoadingId}
            onMarkCollected={(orderId) => void markCollected(orderId)}
            ordersUnauthorized={ordersUnauthorized}
          />

        </div>
      )}
      {activeTab === 'sales' && (
        <div className="admin-reports admin-sales-panel">
          {salesError ? <p className="admin-inline-error">{salesError}</p> : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}

          <div className="admin-sales-kpis">
            <article className="admin-sales-kpi"><p>Total revenue</p><strong>{formatPrice(salesData?.kpis.revenuePence ?? 0)}</strong></article>
            <article className="admin-sales-kpi"><p>Orders count</p><strong>{salesData?.kpis.ordersCount ?? 0}</strong></article>
            <article className="admin-sales-kpi"><p>Average order value</p><strong>{formatPrice(salesData?.kpis.avgOrderValuePence ?? 0)}</strong></article>
            <article className="admin-sales-kpi"><p>Best-selling product</p><strong>{salesData?.kpis.bestProduct ? `${salesData.kpis.bestProduct.name} (${formatPrice(salesData.kpis.bestProduct.revenuePence)})` : '—'}</strong></article>
          </div>

          <div className="admin-sales-controls">
            <div className="admin-filter-tabs" role="tablist" aria-label="Sales range presets">
              <button type="button" className={`admin-filter-tab ${salesPreset === '7' ? 'admin-filter-tab--active' : ''}`} onClick={() => applyPreset('7')}>Last 7 days</button>
              <button type="button" className={`admin-filter-tab ${salesPreset === '30' ? 'admin-filter-tab--active' : ''}`} onClick={() => applyPreset('30')}>Last 30 days</button>
              <button type="button" className={`admin-filter-tab ${salesPreset === '90' ? 'admin-filter-tab--active' : ''}`} onClick={() => applyPreset('90')}>Last 90 days</button>
              <button type="button" className={`admin-filter-tab ${salesPreset === 'custom' ? 'admin-filter-tab--active' : ''}`} onClick={() => setSalesPreset('custom')}>Custom</button>
            </div>

            {salesPreset === 'custom' ? (
              <div className="admin-sales-custom-dates">
                <label>From<input type="date" value={salesFrom} onChange={(event) => setSalesFrom(event.target.value)} /></label>
                <label>To<input type="date" value={salesTo} onChange={(event) => setSalesTo(event.target.value)} /></label>
              </div>
            ) : null}
                        <div className="admin-filter-tabs admin-filter-tabs--metric" role="tablist" aria-label="Sales metric toggle">
              <button type="button" className={`admin-filter-tab ${salesMetric === 'revenue' ? 'admin-filter-tab--active' : ''}`} onClick={() => setSalesMetric('revenue')}>Revenue (£)</button>
              <button type="button" className={`admin-filter-tab ${salesMetric === 'units' ? 'admin-filter-tab--active' : ''}`} onClick={() => setSalesMetric('units')}>Units</button>
            </div>


</div>
            <>
              <div className="admin-sales-chart-wrap">
                                {isMobileSalesView ? (
                  <button
                    type="button"
                    className="admin-sales-expand-btn"
                    onClick={() => setIsSalesChartExpanded(true)}
                    aria-label="Expand sales chart"
                  >
                    Expand
                  </button>
                ) : null}

                <SalesChartErrorBoundary>
                  <MiniLineChart
                    series={chartSeries}
                    metric={salesMetric}
                    getSeriesColor={getSeriesColor}
                    getSeriesStrokeWidth={getSeriesStrokeWidth}

                    height={isMobileSalesView ? 'clamp(280px, 45vh, 520px)' : undefined}
                    onExpand={isMobileSalesView ? () => setIsSalesChartExpanded(true) : undefined}
                    useResponsiveResize={isMobileSalesView}
                  />

                </SalesChartErrorBoundary>
                
                <SeriesPills
                 seriesList={legendSeries}
                  onRemove={removeSeriesSelection}


                  maxHintVisible={Boolean(selectionLimitMessage)}
                  emptySelectionHintVisible={chartSeries.length === 0}
                />

              </div>
              {isMobileSalesView && isSalesChartExpanded ? (
                <div className="admin-sales-modal" role="dialog" aria-modal="true" aria-label="Expanded sales chart">
                  <button type="button" className="admin-sales-modal-backdrop" onClick={() => setIsSalesChartExpanded(false)} aria-label="Close expanded chart" />
                  <div className="admin-sales-modal-panel">
                    <div className="admin-sales-modal-header">
                      <p>Sales chart</p>
                      <button type="button" className="btn btn--secondary" onClick={() => setIsSalesChartExpanded(false)}>Close</button>
                    </div>
                    <SalesChartErrorBoundary>
                      <MiniLineChart
                        series={chartSeries}
                        metric={salesMetric}
                        getSeriesStrokeWidth={getSeriesStrokeWidth}
                        height="clamp(220px, 34vh, 320px)"
                        useResponsiveResize
                      />
                    </SalesChartErrorBoundary>

                  </div>
                </div>
              ) : null}

                    <div className="admin-sales-modal-selector">

                      <label className="admin-sales-modal-search-wrap">
                        <span className="sr-only">Search products</span>
                        <input
                          type="search"
                          className="admin-sales-modal-search"
                          value={expandedProductSearch}
                          onChange={(event) => setExpandedProductSearch(event.target.value)}
                          placeholder="Search products"
                          aria-label="Search products"
                        />
                      </label>

                      <div className="admin-sales-search-results" role="list" aria-label="Search results">
                        {filteredExpandableProducts.map((series) => (
                          <button
                            key={`search-${series.key}`}
                            type="button"
                            className="admin-sales-search-result"
                            onClick={() => handleAddSeriesSelection(series.key)}
                          >
                            <span className="admin-sales-series-pill__swatch" style={{ background: series.color }} aria-hidden="true" />
                            <span>{series.label}</span>
                          </button>
                        ))}
                      </div>

                    </div>


              <div className="admin-products-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Product</th><th>Units sold</th><th>Revenue (GBP)</th></tr></thead>
                  <tbody>
                    {(salesData?.leaderboard ?? []).length === 0 ? (
                      <tr><td colSpan={3}>No paid order items in this range.</td></tr>
                    ) : (
                      (salesData?.leaderboard ?? []).map((row) => (
                        <tr key={row.productId}><td>{row.name}</td><td>{row.units}</td><td>{formatPrice(row.revenuePence)}</td></tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
        </div>
      )}


    </section>
  );
}
