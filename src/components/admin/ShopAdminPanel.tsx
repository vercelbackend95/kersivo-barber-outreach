import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import OrdersDataTable22 from './OrdersDataTable22';
import ClientProfilePanel from './ClientProfilePanel';
import AdminSectionHeader from './AdminSectionHeader';
import AdminLineChart from './charts/AdminLineChart';
import AdminAnalyticsStudio from './AdminAnalyticsStudio';
import AdminSegmentedControl from './AdminSegmentedControl';
import AdminSegmentedRangeControl, { type SegmentedDateRange } from './AdminSegmentedRangeControl';
import AdminChartLegend from './AdminChartLegend';
import AdminLeaderboard from './AdminLeaderboard';
import { CHART_OVERALL_COLOR, getProductSlotColor } from '@/lib/admin/chartSeriesColors';
import { SettingsGearIcon } from './SettingsGearIcon';
import EmptyState from '../EmptyState';
import { ChevronDown, ChevronUp, Package, Plus, Search, Star, X } from '../lucide-react';
import { formatDelta } from './reportsFormatting';
import { SkeletonBookingChoices } from '../skeleton';
import { AdminFetchError, adminFetchJson, isPublicAdminDemoMode, notifyAdminDemoBlocked } from './adminAuth';
import { resolveClientIdForBooking } from '../../lib/admin/resolveClientIdForBooking';
import RetailOnboardingWelcome from './retail-onboarding/RetailOnboardingWelcome';
import RetailOnboardingTaskCard from './retail-onboarding/RetailOnboardingTaskCard';
type ShopTab = 'products' | 'orders' | 'sales';
type SalesRangePreset = '7' | '30' | '90' | 'custom';

type SalesMetric = 'revenue' | 'units';
type ProductCategory = 'POMADES_AND_CLAYS' | 'BEARD_CARE' | 'HAIR_WASH' | 'STYLING' | 'TOOLS' | 'GIFT_SETS';

const PRODUCT_CATEGORY_OPTIONS: Array<{ value: ProductCategory; label: string }> = [
  { value: 'POMADES_AND_CLAYS', label: 'Pomades & Clays' },
  { value: 'BEARD_CARE', label: 'Beard Care' },
  { value: 'HAIR_WASH', label: 'Hair Wash' },
  { value: 'STYLING', label: 'Styling' },
  { value: 'TOOLS', label: 'Tools' },
  { value: 'GIFT_SETS', label: 'Gift Sets' }
];


type Product = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  category: ProductCategory;
  sortOrder: number;
  updatedAt: string;
};
type OrderListItem = {
  id: string;
    orderNumber?: string | null;
  customerName?: string | null;

  customerEmail: string;
  status: 'PAID' | 'READY_FOR_PICKUP' | 'COLLECTED';
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  isTestOrder?: boolean;
  _count: { items: number };
};

type OrderDetail = {
  id: string;
    orderNumber?: string | null;
  customerName?: string | null;

  customerEmail: string;
  status: 'PAID' | 'READY_FOR_PICKUP' | 'COLLECTED';
  totalPence: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  collectedAt: string | null;
  isTestOrder?: boolean;
  items: Array<{
    id: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};
type SalesKpis = {
  revenuePence: number;
  ordersCount: number;
  avgOrderValuePence: number;
  bestProduct?: { productId: string; name: string; revenuePence: number; units: number };
};

type SalesResponse = {
  range: { from: string; to: string; tz: string };
  kpis: SalesKpis;
  previousKpis?: SalesKpis | null;
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
    category: ProductCategory;
  sortOrder: number;
};
type ProductFilter = 'all' | 'active' | 'inactive' | 'featured';
type ProductSortMode = 'manual' | 'newest' | 'price' | 'name';

const PRODUCT_SORT_OPTIONS: Array<{ value: ProductSortMode; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'newest', label: 'Newest' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' },
];



type SalesChartSeries = {
  key: string;
  name: string;
  points: Array<{ date: string; revenuePence: number; units: number }>;
};

type SalesChartErrorBoundaryProps = {
  children: React.ReactNode;
};

type SalesChartErrorBoundaryState = {
  hasError: boolean;
};

type ShopPanelErrorBoundaryProps = {
  children: React.ReactNode;
};

type ShopPanelErrorBoundaryState = {
  hasError: boolean;
};

const MAX_SELECTED_PRODUCTS = 5;
const SALES_SELECTION_LIMIT_MESSAGE = 'Max 5 products can be compared.';


function useBulkSelection<T extends string>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds]);

  return { selectedIds, toggle, selectAll, clearAll, isSelected, selectedCount: selectedIds.size };
}

function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previousStyles = {
      htmlOverflow: documentElement.style.overflow,
      bodyOverflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior
    };

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'contain';

    return () => {
      documentElement.style.overflow = previousStyles.htmlOverflow;
      body.style.overflow = previousStyles.bodyOverflow;
      body.style.overscrollBehavior = previousStyles.overscrollBehavior;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });

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
    category: 'STYLING',
  sortOrder: 0
};
const SORT_ORDER_MIN = 0;
const SORT_ORDER_MAX = 9999;
const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_ALLOWED_MIME_PREFIX = 'image/';
const PRODUCT_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';
const MOBILE_PRODUCT_EDITOR_MEDIA_QUERY = '(max-width: 47.99rem)';

type ProductImageUploadStatus = 'idle' | 'uploading' | 'processing' | 'uploaded' | 'failed';
const DEFAULT_PRODUCT_SERIES_COLOR = 'var(--border)';

const SALES_RANGE_OPTIONS = [
  { value: '7' as const, label: '7 days' },
  { value: '30' as const, label: '30 days' },
  { value: '90' as const, label: '90 days' },
];

const SALES_TIMEZONE = 'Europe/London';

const SALES_METRIC_OPTIONS = [
  { value: 'revenue' as const, label: 'Revenue £' },
  { value: 'units' as const, label: 'Units' },
];

const IS_DEV = import.meta.env.DEV;

function debugUploadLog(message: string, details?: Record<string, unknown>) {
  if (!IS_DEV) return;
  if (details) {
    console.info(`[product-upload] ${message}`, details);
    return;
  }
  console.info(`[product-upload] ${message}`);
}




function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pricePence / 100);
}
function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchesOrder(order: OrderListItem, query: string): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const totalGbp = order.totalPence / 100;
  const searchableFields = [
    order.customerName ?? '',
    order.customerEmail,
    order.id,
    order.orderNumber ?? '',
    order.status,
    String(order.totalPence),
    String(totalGbp),
    totalGbp.toFixed(2),
    `£${totalGbp}`,
    `£${totalGbp.toFixed(2)}`
  ];

  return searchableFields.some((field) => normalize(field).includes(normalizedQuery));
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

class ShopPanelErrorBoundary extends React.Component<ShopPanelErrorBoundaryProps, ShopPanelErrorBoundaryState> {
  state: ShopPanelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ShopPanelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Shop panel rendering error:', error);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-inline-error" role="alert">
          <p>Shop failed to render.</p>
          <button type="button" className="btn btn--secondary" onClick={this.handleReload}>Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}




type ProductStatusPillProps = {
  on: boolean;
  tone: 'active';
  onLabel: string;
  offLabel: string;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
};

function ProductStatusPill({ on, tone, onLabel, offLabel, disabled, ariaLabel, onClick }: ProductStatusPillProps) {
  return (
    <button
      type="button"
      className={[
        'admin-product-row__status-pill',
        `admin-product-row__status-pill--${tone}`,
        on ? 'is-on' : ''
      ].filter(Boolean).join(' ')}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="admin-product-row__status-dot" aria-hidden="true" />
      <span>{on ? onLabel : offLabel}</span>
    </button>
  );
}

type ProductStatusSwitchProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onLabel: string;
  offLabel: string;
  tone: 'active' | 'featured';
  onChange: (nextValue: boolean) => void;
  /** Compact single-line treatment for product list cards */
  variant?: 'default' | 'card';
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


function ProductStatusSwitch({
  label,
  checked,
  disabled = false,
  onLabel,
  offLabel,
  tone,
  onChange,
  variant = 'default'
}: ProductStatusSwitchProps) {
  const statusLabel = checked ? onLabel : offLabel;
  return (
    <div
      className={['admin-product-switch', variant === 'card' ? 'admin-product-switch--card' : ''].filter(Boolean).join(' ')}
      data-tone={tone}
    >
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



type BulkActionBarProps = {
  count: number;
  loading: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onClear: () => void;
};

function BulkActionBar({ count, loading, onActivate, onDeactivate, onClear }: BulkActionBarProps) {
  return createPortal(
    <div
      className={`admin-bulk-bar${count > 0 ? ' admin-bulk-bar--visible' : ''}`}
      role="toolbar"
      aria-label="Bulk product actions"
      aria-hidden={count === 0}
    >
      <span className="admin-bulk-bar__count">
        {count} {count === 1 ? 'selected' : 'selected'}
      </span>
      <div className="admin-bulk-bar__actions">
        <button
          type="button"
          className="btn btn--primary admin-bulk-bar__btn"
          disabled={loading || count === 0}
          onClick={onActivate}
          aria-label={`Activate ${count} selected products`}
        >
          {loading ? <span className="admin-bulk-spinner" aria-hidden="true" /> : null}
          Activate
        </button>
        <button
          type="button"
          className="btn btn--secondary admin-bulk-bar__btn"
          disabled={loading || count === 0}
          onClick={onDeactivate}
          aria-label={`Deactivate ${count} selected products`}
        >
          Deactivate
        </button>
        <button
          type="button"
          className="admin-bulk-bar__clear"
          disabled={loading}
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X width={16} height={16} aria-hidden="true" /> Clear
        </button>
      </div>
    </div>,
    document.body
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
  const [retailPromptDismissed, setRetailPromptDismissed] = useState(true); // hide until session loads
  const [retailFlagsLoaded, setRetailFlagsLoaded] = useState(false);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [debouncedOrdersSearchQuery, setDebouncedOrdersSearchQuery] = useState('');

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderDetailsById, setOrderDetailsById] = useState<Record<string, OrderDetail>>({});
  const [orderDetailsLoadingId, setOrderDetailsLoadingId] = useState<string | null>(null);

  const [ordersUnauthorized, setOrdersUnauthorized] = useState(false);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [walkthroughOrderId, setWalkthroughOrderId] = useState<string | null>(null);
  const [showRetailWalkthroughComplete, setShowRetailWalkthroughComplete] = useState(false);

  const [salesPreset, setSalesPreset] = useState<SalesRangePreset>('7');
  const [salesFrom, setSalesFrom] = useState(() => getRangeDates('7').from);
  const [salesTo, setSalesTo] = useState(() => getRangeDates('7').to);
  const [salesCustomRange, setSalesCustomRange] = useState<SegmentedDateRange | null>(null);
  const [salesMetric, setSalesMetric] = useState<SalesMetric>('revenue');
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [isMobileSalesView, setIsMobileSalesView] = useState(false);
  const [isMobileOrdersView, setIsMobileOrdersView] = useState(false);
  const [isMobileProductEditor, setIsMobileProductEditor] = useState(false);

  const [isSalesChartExpanded, setIsSalesChartExpanded] = useState(false);
  const [expandedProductSearch, setExpandedProductSearch] = useState('');
  const [productAddOpen, setProductAddOpen] = useState(false);
    useBodyScrollLock((formOpen && isMobileProductEditor) || (isMobileSalesView && isSalesChartExpanded));


    const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productSortMode, setProductSortMode] = useState<ProductSortMode>('manual');
  const [productSortOpen, setProductSortOpen] = useState(false);
  const [manualOrderIds, setManualOrderIds] = useState<string[]>([]);
  const [productSavingById, setProductSavingById] = useState<Record<string, boolean>>({});
  const [productStatusById, setProductStatusById] = useState<Record<string, string>>({});
  const [formInitial, setFormInitial] = useState<ProductFormState>(EMPTY_FORM);
  const [footerFeedback, setFooterFeedback] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState<ProductImageUploadStatus>('idle');
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [hasPendingFileUpload, setHasPendingFileUpload] = useState(false);
  const [debouncedImageUrlPreview, setDebouncedImageUrlPreview] = useState('');
  const imageUploadAbortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const productFiltersScrollRef = useRef<HTMLDivElement | null>(null);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  const productSortRef = useRef<HTMLDivElement | null>(null);
  const salesFetchRequestRef = useRef(0);

  const {
    selectedIds: bulkSelectedIds,
    toggle: bulkToggle,
    selectAll: bulkSelectAll,
    clearAll: bulkClearAll,
    isSelected: bulkIsSelected,
    selectedCount: bulkSelectedCount
  } = useBulkSelection<string>();
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleProductSearchClear = useCallback(() => {
    setProductSearch('');
    productSearchInputRef.current?.focus();
  }, []);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );
  

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(MOBILE_PRODUCT_EDITOR_MEDIA_QUERY);
    const handleChange = () => {
      setIsMobileSalesView(mediaQuery.matches);
      setIsMobileProductEditor(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setIsSalesChartExpanded(false);
      }
    };
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 56.24rem)');
    const handleChange = () => {
      setIsMobileOrdersView(mediaQuery.matches);
    };
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const node = productFiltersScrollRef.current;
    if (!node) return;

    const updateEdgeHint = () => {
      const isAtEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2;
      node.parentElement?.classList.toggle('admin-filter-scroll-wrap--at-end', isAtEnd);
    };

    updateEdgeHint();
    node.addEventListener('scroll', updateEdgeHint, { passive: true });
    window.addEventListener('resize', updateEdgeHint);

    return () => {
      node.removeEventListener('scroll', updateEdgeHint);
      window.removeEventListener('resize', updateEdgeHint);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'products') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      productSearchInputRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  useEffect(() => {
    if (!productSortOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (productSortRef.current?.contains(event.target as Node)) return;
      setProductSortOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProductSortOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [productSortOpen]);

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
  const productsInitiallyLoading = loading && products.length === 0;
  const effectiveImagePreviewUrl = useMemo(() => {
    if (localImagePreviewUrl) return localImagePreviewUrl;
    return debouncedImageUrlPreview;
  }, [debouncedImageUrlPreview, localImagePreviewUrl]);




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
        if (deleteConfirmOpen) {
          setDeleteConfirmOpen(false);
          return;
        }
        resetForm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmOpen, formOpen]);

  useEffect(() => {
    if (!isSalesChartExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSalesChartExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSalesChartExpanded]);
  
  useEffect(() => {
    if (!footerFeedback) return;
    const timeoutId = window.setTimeout(() => setFooterFeedback(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [footerFeedback]);

  useEffect(() => {
    bulkClearAll();
  }, [productFilter, productSearch, productSortMode]);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedImageUrlPreview(form.imageUrl.trim());
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [form.imageUrl]);

  useEffect(() => {
    return () => {
      if (localImagePreviewUrl) {
        URL.revokeObjectURL(localImagePreviewUrl);
      }
    };
  }, [localImagePreviewUrl]);



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
    return getProductSlotColor(slotIndex);
  }, [selectedProductIds]);

  const getSeriesColor = useCallback((seriesKey: string): string => {
    if (seriesKey === 'overall') return CHART_OVERALL_COLOR;
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

  const adminChartSeries = useMemo(
    () =>
      chartSeries.map((s) => ({
        key: s.key,
        name: s.name,
        points: (s.points ?? []).map((p) => ({
          label: p.date,
          value: salesMetric === 'revenue' ? p.revenuePence : p.units,
        })),
      })),
    [chartSeries, salesMetric],
  );

  const fmtSalesValue = useCallback(
    (v: number) => (salesMetric === 'revenue' ? formatPrice(v) : `${Math.round(v)} units`),
    [salesMetric],
  );

  const salesKpiDeltas = useMemo(() => {
    const prev = salesData?.previousKpis ?? null;
    if (!prev) return null;

    const pctOrNull = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : null;

    const current = salesData!.kpis;

    return {
      revenue: formatDelta({
        value: pctOrNull(current.revenuePence, prev.revenuePence),
        type: 'percent',
        tone: 'higher_better',
        currentValue: current.revenuePence,
        previousValue: prev.revenuePence
      }),
      orders: formatDelta({
        value: pctOrNull(current.ordersCount, prev.ordersCount),
        type: 'percent',
        tone: 'higher_better',
        currentValue: current.ordersCount,
        previousValue: prev.ordersCount
      }),
      avgOrderValue: formatDelta({
        value: pctOrNull(current.avgOrderValuePence, prev.avgOrderValuePence),
        type: 'percent',
        tone: 'higher_better',
        currentValue: current.avgOrderValuePence,
        previousValue: prev.avgOrderValuePence
      })
    };
  }, [salesData]);

  const salesHeroValue = useMemo(
    () => (salesMetric === 'revenue'
      ? formatPrice(salesData?.kpis.revenuePence ?? 0)
      : `${salesData?.kpis.ordersCount ?? 0}`),
    [salesData, salesMetric],
  );

  const salesHeroLabel = salesMetric === 'revenue'
    ? 'Revenue in selected period'
    : 'Orders in selected period';

  const salesLeaderboardRows = useMemo(
    () => (salesData?.leaderboard ?? []).map((row) => ({
      id: row.productId,
      name: row.name,
      value: salesMetric === 'revenue' ? row.revenuePence : row.units,
      valueLabel: salesMetric === 'revenue'
        ? formatPrice(row.revenuePence)
        : `${row.units} units`,
      note: salesMetric === 'revenue'
        ? `${row.units} units`
        : formatPrice(row.revenuePence),
    })),
    [salesData, salesMetric],
  );

  const ordersSafe = orders ?? [];
  const paidOrdersCount = useMemo(
    () => ordersSafe.filter((order) => order.status === 'PAID').length,
    [ordersSafe],
  );
  const collectedOrdersCount = useMemo(
    () => ordersSafe.filter((order) => order.status === 'COLLECTED').length,
    [ordersSafe],
  );

  const walkthroughOrder = useMemo(
    () => (walkthroughOrderId ? ordersSafe.find((order) => order.id === walkthroughOrderId) : null),
    [ordersSafe, walkthroughOrderId],
  );

  useEffect(() => {
    if (walkthroughOrder?.status === 'COLLECTED') {
      setShowRetailWalkthroughComplete(true);
    }
  }, [walkthroughOrder?.status]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = normalize(debouncedOrdersSearchQuery);
    if (!normalizedQuery) return ordersSafe;
    return ordersSafe.filter((order) => matchesOrder(order, normalizedQuery));
  }, [debouncedOrdersSearchQuery, ordersSafe]);

  const filteredExpandableProducts = useMemo(() => {
    const normalizedQuery = expandedProductSearch.trim().toLowerCase();
    return seriesPills.filter((series) => {
      if (activeSeriesKeys.includes(series.key)) return false;
      if (!normalizedQuery) return true;
      return series.label.toLowerCase().includes(normalizedQuery);
    });
  }, [activeSeriesKeys, expandedProductSearch, seriesPills]);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedOrdersSearchQuery(ordersSearchQuery);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ordersSearchQuery]);

  useEffect(() => {
    if (typeof window === 'undefined' || activeTab !== 'orders') return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order')?.trim() || null;
    const retailWalkthrough = params.get('retailWalkthrough') === '1';
    if (!orderId) return;

    setHighlightedOrderId(orderId);
    if (retailWalkthrough) {
      setWalkthroughOrderId(orderId);
    }
    setExpandedOrderId(orderId);
    void fetchOrderDetails(orderId);

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`admin-order-${orderId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 350);

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedOrderId((current) => (current === orderId ? null : current));
    }, 8000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [activeTab, ordersLoading]);


  const handleAddSeriesSelection = (seriesKey: string) => {
    addSeriesSelection(seriesKey);
    setExpandedProductSearch('');
  };





  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminFetchJson<{ products: Product[] }>('/api/admin/shop/products', {
        errorMessage: 'Could not fetch products.',
      });
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
      const payload = await adminFetchJson<{ orders: OrderListItem[] }>('/api/admin/shop/orders', {
        errorMessage: 'Could not fetch orders.',
      });
      setOrders(payload.orders as OrderListItem[]);
    } catch (fetchError) {
      if (fetchError instanceof AdminFetchError && fetchError.status === 401) {
        setOrders([]);
        setExpandedOrderId(null);
        setOrderDetailsById({});

        setOrdersUnauthorized(true);
        return;
      }
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch orders.');
    } finally {
      setOrdersLoading(false);

    }
  }

  async function fetchOrderDetails(orderId: string) {
    setError(null);
    setOrderDetailsLoadingId(orderId);
    try {
      const payload = await adminFetchJson<{ order: OrderDetail }>(`/api/admin/shop/orders/${orderId}`, {
        errorMessage: 'Could not fetch order details.',
      });
      const detail = payload.order as OrderDetail;
      setOrderDetailsById((previous) => ({ ...previous, [detail.id]: detail }));

    } catch (fetchError) {
      if (fetchError instanceof AdminFetchError && fetchError.status === 401) {
        setExpandedOrderId(null);
        setOrdersUnauthorized(true);
        return;
      }
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch order details.');
          } finally {
      setOrderDetailsLoadingId((previous) => (previous === orderId ? null : previous));

    }
  }

  async function fetchSales(options?: { explicitFrom?: string; explicitTo?: string; explicitPreset?: SalesRangePreset }) {
    const requestId = salesFetchRequestRef.current + 1;
    salesFetchRequestRef.current = requestId;
    setSalesLoading(true);
    setSalesError(null);

    const preset = options?.explicitPreset ?? salesPreset;
    const from = options?.explicitFrom ?? salesFrom;
    const to = options?.explicitTo ?? salesTo;

    const range =
      preset === 'custom'
        ? { from, to }
        : getRangeDates(preset);

    const query = new URLSearchParams();
    query.set('from', range.from);
    query.set('to', range.to);

    try {
      const payload = await adminFetchJson<SalesResponse>(`/api/admin/shop/sales?${query.toString()}`, {
        errorMessage: 'Could not fetch sales analytics.',
      });
      if (salesFetchRequestRef.current !== requestId) return;
      setSalesData(payload as SalesResponse);
    } catch (fetchError) {
      if (salesFetchRequestRef.current !== requestId) return;
      setSalesError(fetchError instanceof Error ? fetchError.message : 'Could not fetch sales analytics.');
    } finally {
      if (salesFetchRequestRef.current === requestId) {
        setSalesLoading(false);
      }
    }
  }


  useEffect(() => {
    void fetchProducts();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/admin/session', { credentials: 'include' });
        if (!response.ok) {
          setRetailPromptDismissed(false);
          setRetailFlagsLoaded(true);
          return;
        }
        const payload = (await response.json()) as {
          retailOnboardingCompleted?: boolean;
          retailOnboardingSkipped?: boolean;
          via?: string;
        };
        const hidePrompt =
          payload.via !== 'session' ||
          Boolean(payload.retailOnboardingCompleted) ||
          Boolean(payload.retailOnboardingSkipped);
        setRetailPromptDismissed(hidePrompt);
      } catch {
        setRetailPromptDismissed(false);
      } finally {
        setRetailFlagsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') {
      void fetchOrders();
    }
  }, [activeTab]);
  const salesDateError = useMemo(() => {
    if (salesPreset !== 'custom') return null;
    if (!salesFrom || !salesTo) return null;
    return salesFrom > salesTo ? 'End date must be after start date' : null;
  }, [salesPreset, salesFrom, salesTo]);

  useEffect(() => {
    if (activeTab !== 'sales') return;
    if (salesDateError) return;
    void fetchSales();
  }, [activeTab, salesPreset, salesFrom, salesTo, salesDateError]);



  useEffect(() => {
    if (activeTab !== 'orders') return;
    const intervalId = window.setInterval(() => {
      void fetchOrders();
      if (expandedOrderId) {
        void fetchOrderDetails(expandedOrderId);

      }
    }, 120000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, expandedOrderId]);


  function resetForm(force = false) {
    const uploadInFlight = imageUploadStatus === 'uploading' || imageUploadStatus === 'processing';
    if (uploadInFlight && !force) {
      const shouldCancel = window.confirm('Image upload is still in progress. Cancel upload and close?');
      if (!shouldCancel) {
        return;
      }
    }

    if (uploadInFlight && imageUploadAbortControllerRef.current) {
      imageUploadAbortControllerRef.current.abort();
      imageUploadAbortControllerRef.current = null;

    }
    setLocalImagePreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setSelectedImageFile(null);
        setHasPendingFileUpload(false);
    setImageUploadStatus('idle');
    setImageUploadError(null);
    setImageUploadProgress(0);

    setForm(EMPTY_FORM);
    setFormInitial(EMPTY_FORM);
    setFooterFeedback(null);


    setDeleteConfirmOpen(false);

    setFormOpen(false);
  }

  function startCreate() {
    if (isPublicAdminDemoMode()) {
      notifyAdminDemoBlocked();
      return;
    }
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
    setImageUploadStatus('idle');
    setImageUploadError(null);
    setImageUploadProgress(0);
    setSelectedImageFile(null);
    setHasPendingFileUpload(false);

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
            category: product.category,
      sortOrder: normalizedSortOrder
    };
    setForm(nextForm);
    setFormInitial(nextForm);

    setFormOpen(true);
    setError(null);
    setSuccess(null);
    setFooterFeedback(null);
    setImageUploadStatus('idle');

    setImageUploadError(null);
    setImageUploadProgress(0);
    setSelectedImageFile(null);
        setHasPendingFileUpload(false);
    setLocalImagePreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }

  async function uploadProductImage(file: File) {
    const body = new FormData();
    body.set('file', file);

    const controller = new AbortController();
    imageUploadAbortControllerRef.current = controller;

    const fallbackProgressTimeoutId = window.setTimeout(() => {
      setImageUploadProgress((previous) => (previous === 0 ? 15 : previous));
    }, 250);

    try {
      const response = await fetch('/api/admin/products/upload-image', {
        method: 'POST',
        credentials: 'include',
        body,
        signal: controller.signal
      });

      window.clearTimeout(fallbackProgressTimeoutId);
      setImageUploadStatus('processing');
      setImageUploadProgress(90);

      const payload = (await response.json().catch(() => ({}))) as { code?: string; url?: string; error?: string };
      if (!response.ok) {
        const nextError = new Error(payload.error || 'Upload failed.');
        if (payload.code) {
          nextError.name = payload.code;
        }
        throw nextError;

      }

      if (!payload.url) {
        throw new Error('Upload failed. Invalid response.');
      }

      return payload.url;
    } catch (error) {
      window.clearTimeout(fallbackProgressTimeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Upload was cancelled.');
      }
      throw error;
    } finally {
      imageUploadAbortControllerRef.current = null;
    }

  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith(PRODUCT_IMAGE_ALLOWED_MIME_PREFIX)) {
      setImageUploadStatus('failed');
      setImageUploadError('Please choose an image file.');
      return;
    }
    if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
      setImageUploadStatus('failed');
      setImageUploadError('Image is too large. Maximum size is 5MB.');
      return;
    }
    debugUploadLog('upload started', { name: file.name, size: file.size, type: file.type });
    setSelectedImageFile(file);
    setHasPendingFileUpload(true);
    setImageUploadError(null);
        setForm((previous) => ({ ...previous, imageUrl: '' }));
    setImageUploadStatus('uploading');
    setImageUploadProgress(0);
    setLocalImagePreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });

    try {
      const uploadedUrl = await uploadProductImage(file);
            debugUploadLog('upload done', { url: uploadedUrl });
      setForm((previous) => ({ ...previous, imageUrl: uploadedUrl }));
      setImageUploadStatus('uploaded');
      setImageUploadProgress(100);
      setImageUploadError(null);
            setHasPendingFileUpload(false);
      setSelectedImageFile(null);
      setLocalImagePreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    } catch (uploadError) {
      setImageUploadStatus('failed');
      setHasPendingFileUpload(true);
      setImageUploadError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
      debugUploadLog('upload failed', { message: uploadError instanceof Error ? uploadError.message : 'Unknown error' });
    }
  }

  async function onImageFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    await handleImageUpload(file);
  }

  async function retryImageUpload() {
    if (!selectedImageFile) return;
    await handleImageUpload(selectedImageFile);

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
        if (imageUploadStatus === 'uploading' || imageUploadStatus === 'processing') {
      debugUploadLog('save blocked while upload in-flight');
      setError('Please wait until image upload finishes before saving.');
      return;
    }

    if (hasPendingFileUpload && !form.imageUrl.trim()) {
            debugUploadLog('save blocked until upload done', { hasPendingFileUpload: true });
      setError('Finish uploading product image or provide Image URL fallback before saving.');
      return;
    }

    debugUploadLog('save attempt', { hasImageUrl: Boolean(form.imageUrl.trim()) });
    setSaving(true);
    try {
      const endpoint = form.id ? '/api/admin/shop/products/update' : '/api/admin/shop/products/create';
      await adminFetchJson<{ product: Product }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: trimmedName,
          description: form.description.trim(),
          pricePence,
          imageUrl: form.imageUrl.trim(),
          active: form.featured ? true : form.active,
          featured: form.active ? form.featured : false,
          category: form.category,
          sortOrder: Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, form.sortOrder))
        }),
        errorMessage: 'Unable to save product.',
      });

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
      const payload = await adminFetchJson<{ product: Product }>(`/api/admin/shop/products/${productId}`, {
        method: 'PATCH',

        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
        errorMessage: 'Unable to update product.',
      });
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

  async function bulkPatchActive(active: boolean) {
    if (bulkLoading) return;
    const ids = Array.from(bulkSelectedIds);
    if (ids.length === 0) return;

    setBulkLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const results = await Promise.allSettled(
        ids.map((id) => {
          const existing = products.find((p) => p.id === id);
          const body = active
            ? { active: true, featured: existing?.featured ?? false }
            : { active: false, featured: false };
          return adminFetchJson<{ product: Product }>(`/api/admin/shop/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            errorMessage: 'Unable to update product.',
          });
        })
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      await fetchProducts();
      bulkClearAll();

      if (failedCount > 0) {
        setError(`${ids.length - failedCount} updated, ${failedCount} failed.`);
      } else {
        setSuccess(`${ids.length} product${ids.length !== 1 ? 's' : ''} ${active ? 'activated' : 'deactivated'}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk operation failed.');
    } finally {
      setBulkLoading(false);
    }
  }

  async function disableProduct(productId: string) {
    setError(null);
    setSuccess(null);
    try {
      await adminFetchJson<{ product?: Product }>('/api/admin/shop/products/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId }),
        errorMessage: 'Unable to delete product.',
      });
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
      const payload = await adminFetchJson<{ products?: Product[] }>('/api/admin/shop/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
        errorMessage: 'Unable to save order.',
      });
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
      await adminFetchJson<{ order?: OrderDetail }>(`/api/admin/shop/orders/${orderId}/collect`, {
        method: 'POST',
        errorMessage: 'Unable to mark order as collected.',
      });
      await fetchOrders();
      await fetchOrderDetails(orderId);
      setSuccess('Order marked as collected.');
      if (walkthroughOrderId === orderId) {
        setShowRetailWalkthroughComplete(true);
      }
    } catch (collectError) {
      if (collectError instanceof AdminFetchError && collectError.status === 401) {
        setOrdersUnauthorized(true);
        setExpandedOrderId(null);
        return;
      }
      setError(collectError instanceof Error ? collectError.message : 'Unable to mark order as collected.');
    }
  }

  const handleOpenClientProfile = useCallback(async (contact: { email: string; fullName: string }) => {
    try {
      const clientId = await resolveClientIdForBooking({
        email: contact.email,
        fullName: contact.fullName,
      });
      if (clientId) setOpenClientId(clientId);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not open client profile.');
    }
  }, []);


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
    setSalesCustomRange(null);
    setSalesPreset(nextPreset);
    setSalesFrom(dates.from);
    setSalesTo(dates.to);
    void fetchSales({
      explicitPreset: nextPreset,
      explicitFrom: dates.from,
      explicitTo: dates.to,
    });
  }

  const handleSalesCustomRangeChange = useCallback((range: SegmentedDateRange | null) => {
    if (!range?.from && !range?.to) {
      setSalesCustomRange(null);
      applyPreset('7');
      return;
    }
    setSalesCustomRange(range);
    if (range.from && range.to) {
      const from = formatInTimeZone(range.from, SALES_TIMEZONE, 'yyyy-MM-dd');
      const to = formatInTimeZone(range.to, SALES_TIMEZONE, 'yyyy-MM-dd');
      setSalesPreset('custom');
      setSalesFrom(from);
      setSalesTo(to);
    }
  }, []);

  const salesRangeForPicker = useMemo((): SegmentedDateRange | null => {
    if (salesCustomRange) return salesCustomRange;
    if (salesPreset !== 'custom' || !salesFrom || !salesTo) return null;
    return {
      from: fromZonedTime(`${salesFrom}T00:00:00.000`, SALES_TIMEZONE),
      to: fromZonedTime(`${salesTo}T00:00:00.000`, SALES_TIMEZONE),
    };
  }, [salesCustomRange, salesFrom, salesPreset, salesTo]);

  const salesSegmentedValue = salesPreset === 'custom' ? ('' as Exclude<SalesRangePreset, 'custom'>) : salesPreset;


  return (
    <ShopPanelErrorBoundary>
      <section className="booking-shell" aria-live="polite">

      <AdminSectionHeader
        title={
          activeTab === 'orders' ? 'Orders'
          : activeTab === 'sales' ? 'Sales Analytics'
          : 'Shop Products'
        }
        description={
          activeTab === 'orders' ? 'Customer orders and fulfilment'
          : activeTab === 'sales' ? 'Revenue and sales trends'
          : 'Retail product catalogue'
        }
        metaBadge={
          activeTab === 'products'
            ? `${products.length} products`
            : undefined
        }
        metaBadges={activeTab === 'orders' ? [
          { label: `${paidOrdersCount} paid`, variant: 'info' },
          { label: `${collectedOrdersCount} collected`, variant: 'success' },
        ] : undefined}
        metaBadgeVariant="default"
        actions={activeTab === 'products' ? (
          <button
            type="button"
            className="btn btn--primary btn--icon"
            aria-label="Add product"
            title="Add product"
            onClick={startCreate}
          >
            <Plus aria-hidden />
          </button>
        ) : undefined}
      />

      {activeTab === 'products' && (
        <div className="admin-reports admin-products-panel">
          <div className="admin-products-toolbar-sticky">
            <div className="admin-products-toolbar">

              {/* Row 1 — Search */}
              <div className="admin-search-bar admin-products-toolbar-search" role="search">
                <Search className="admin-search-bar__icon" width={16} height={16} aria-hidden="true" />
                <input
                  ref={productSearchInputRef}
                  type="search"
                  className="admin-search-bar__input"
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && handleProductSearchClear()}
                  aria-label="Search products"
                  autoComplete="off"
                  spellCheck={false}
                />
                {productSearch ? (
                  <button
                    type="button"
                    className="admin-search-bar__clear"
                    onClick={handleProductSearchClear}
                    aria-label="Clear search"
                  >
                    <X width={14} height={14} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className="admin-search-bar__kbd">/</kbd>
                )}
              </div>

              {/* Row 2 — Controls */}
              <div className="admin-products-toolbar-controls">

                {/* Filter tabs */}
                <div className="admin-filter-scroll-wrap">
                  <div ref={productFiltersScrollRef} className="admin-products-filters" role="group" aria-label="Product filters">
                    {(['all', 'active', 'inactive', 'featured'] as ProductFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={`admin-products-filter-tab${productFilter === filter ? ' admin-products-filter-tab--active' : ''}`}
                        onClick={() => setProductFilter(filter)}
                        aria-pressed={productFilter === filter}
                      >
                        {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'inactive' ? 'Inactive' : 'Featured'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort + Meta — right cluster */}
                <div className="admin-products-toolbar-right">
                  <div
                    ref={productSortRef}
                    className={`admin-products-sort-wrap${productSortOpen ? ' admin-products-sort-wrap--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-products-sort-trigger"
                      aria-label="Sort products"
                      aria-haspopup="listbox"
                      aria-expanded={productSortOpen}
                      onClick={() => setProductSortOpen((open) => !open)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                          event.preventDefault();
                          setProductSortOpen(true);
                        }
                      }}
                    >
                      <span>{PRODUCT_SORT_OPTIONS.find((option) => option.value === productSortMode)?.label}</span>
                      <ChevronDown className="admin-products-sort-chevron" width={12} height={12} aria-hidden="true" />
                    </button>

                    {productSortOpen ? (
                      <div className="admin-products-sort-menu" role="listbox" aria-label="Sort products">
                        {PRODUCT_SORT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`admin-products-sort-option${productSortMode === option.value ? ' admin-products-sort-option--active' : ''}`}
                            role="option"
                            aria-selected={productSortMode === option.value}
                            onClick={() => {
                              setProductSortMode(option.value);
                              setProductSortOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="admin-products-meta">
                    <span className="admin-products-count">{filteredProducts.length} products · {featuredCount} featured</span>
                    {filteredProducts.length > 0 && (
                      <button
                        type="button"
                        className="admin-products-select-all"
                        onClick={() => {
                          const allIds = filteredProducts.map((p) => p.id);
                          if (bulkSelectedCount === filteredProducts.length) {
                            bulkClearAll();
                          } else {
                            bulkSelectAll(allIds);
                          }
                        }}
                        aria-pressed={bulkSelectedCount === filteredProducts.length && filteredProducts.length > 0}
                      >
                        {bulkSelectedCount > 0 && bulkSelectedCount === filteredProducts.length
                          ? 'Deselect all'
                          : bulkSelectedCount > 0
                            ? `Select all (${filteredProducts.length})`
                            : 'Select all'}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {formOpen ? (
            <div
              className={`admin-product-sheet-backdrop${isMobileProductEditor ? '' : ' admin-product-sheet-backdrop--drawer'}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  resetForm();
                }
              }}
            >
              <form
                className="admin-product-sheet"
                onSubmit={saveProduct}
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-product-sheet-title"
              >

                <div className="admin-product-sheet-head">
                  <div className="admin-sheet-head-copy">
                    <div className="admin-sheet-head-title-row">
                      <h3 id="admin-product-sheet-title">{form.id ? 'Edit product' : 'Add product'}</h3>
                      {form.id ? (
                        <span
                          className={`badge badge--sm ${form.active ? 'badge--confirmed' : 'badge--neutral'}`}
                          aria-label={form.active ? 'Active' : 'Inactive'}
                        >
                          {form.active ? 'Active' : 'Inactive'}
                        </span>
                      ) : null}
                    </div>
                    {form.id ? (
                      <p className="admin-sheet-entity-name" title={form.name}>{form.name}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="admin-product-sheet-close"
                    onClick={() => resetForm()}
                    aria-label="Close product form"
                  >
                    <X width={18} height={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="admin-product-sheet-body">
                  <p className="admin-product-unsaved muted">{formDirty ? 'Unsaved changes' : 'All changes saved'}</p>

                  <div className="admin-product-image-section">
                    <p className="admin-product-image-section__title">Image</p>
                    <div className="admin-product-image-controls">
                      <div className="admin-product-image-upload-wrap">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={PRODUCT_IMAGE_ACCEPT}
                          onChange={onImageFileInputChange}
                          className="admin-product-image-file-input"
                          tabIndex={-1}
                          aria-hidden="true"
                          aria-describedby="admin-product-image-upload-help"
                        />
                        <button
                          type="button"
                          className="btn btn--secondary admin-product-image-upload-btn"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={imageUploadStatus === 'uploading' || imageUploadStatus === 'processing'}
                        >
                          <span aria-hidden="true">⇪</span>
                          <span>Upload photo</span>
                        </button>
                      </div>
                      <p id="admin-product-image-upload-help" className="admin-product-image-upload-help muted">Select an image from the phone gallery or device files. Camera capture is disabled.</p>
                      <label className="admin-product-field admin-product-image-url-field">Image URL (fallback)
                        <input
                          type="url"
                          value={form.imageUrl}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setForm((prev) => ({ ...prev, imageUrl: nextValue }));
                            if (nextValue.trim()) {
                              setHasPendingFileUpload(false);
                              setSelectedImageFile(null);
                              setImageUploadStatus('idle');
                              setImageUploadError(null);
                            }
                          }}
                          placeholder="https://..."
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-product-image-preview" aria-hidden="true">
                    {effectiveImagePreviewUrl ? <img src={effectiveImagePreviewUrl} alt="Preview" draggable={false} /> : <span>No image preview</span>}
                  </div>
                  <div className="admin-product-image-status" aria-live="polite">
                    {imageUploadStatus === 'uploading' ? <span>Uploading… {Math.max(1, Math.min(99, imageUploadProgress))}%</span> : null}
                    {imageUploadStatus === 'processing' ? <span>Processing…</span> : null}
                    {imageUploadStatus === 'uploaded' ? <span>Done</span> : null}
                    {imageUploadStatus === 'failed' ? <span>Upload failed</span> : null}
                    {imageUploadError ? <span className="admin-product-image-status__error">{imageUploadError}</span> : null}
                    {imageUploadStatus === 'failed' && selectedImageFile ? (
                      <button type="button" className="btn btn--ghost admin-product-image-retry" onClick={() => { void retryImageUpload(); }}>
                        Retry upload
                      </button>
                    ) : null}
                  </div>

                  <fieldset className="admin-form-section">
                    <legend className="admin-form-section-title">Product Details</legend>

                    <label className="admin-product-field">Name
                      <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                    </label>
                    <label className="admin-product-field">Price (GBP)
                      <div className="admin-price-input-wrap"><span>£</span><input inputMode="decimal" value={form.priceGbp} onChange={(event) => setForm((prev) => ({ ...prev, priceGbp: event.target.value.replace(/[^0-9.,]/g, '') }))} required /></div>
                    </label>
                    <label className="admin-product-field">Description
                      <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} />
                    </label>
                    <label className="admin-product-field">Category
                      <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ProductCategory }))}>
                        {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </fieldset>

                  <fieldset className="admin-form-section">
                    <legend className="admin-form-section-title">Settings</legend>

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
                  </fieldset>
                </div>

                <EditFooterActions
                  canDelete={Boolean(form.id)}
                  disableDelete={saving}
                  saving={saving}
                  canSave={formValid && formDirty && imageUploadStatus !== 'uploading' && imageUploadStatus !== 'processing' && !hasPendingFileUpload}
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

          ) : null}

          <div className="admin-products-scroll" role="region" aria-label="Products list">
            {error ? (
              <div className="admin-inline-error" role="alert">
                <p>{error}</p>
                {!loading ? (
                  <button type="button" className="btn btn--secondary" onClick={() => { void fetchProducts(); }}>
                    Retry products
                  </button>
                ) : null}
              </div>
            ) : null}
            {success ? <p className="admin-inline-success">{success}</p> : null}

            <div className="admin-product-list">
              {productsInitiallyLoading ? (
                <div className="admin-product-list" aria-label="Loading products" aria-busy="true">
                  <SkeletonBookingChoices count={4} variant="service" />
                </div>
              ) : filteredProducts.length === 0 ? (
                baseProducts.length === 0 ? (
                  !retailFlagsLoaded ? (
                    <div className="admin-product-list" aria-label="Loading products" aria-busy="true">
                      <SkeletonBookingChoices count={2} variant="service" />
                    </div>
                  ) : retailPromptDismissed ? (
                    <EmptyState
                      icon={Package}
                      title="No products yet"
                      description="Add your first product to launch your storefront."
                    />
                  ) : (
                    <RetailOnboardingWelcome
                      layout="panel"
                      onYes={() => {
                        window.location.assign('/admin/retail-onboarding?step=1');
                      }}
                      onNotNow={() => {
                        void (async () => {
                          try {
                            await fetch('/api/admin/retail-onboarding/skip', {
                              method: 'POST',
                              credentials: 'include',
                            });
                          } catch {
                            /* ignore */
                          }
                          setRetailPromptDismissed(true);
                        })();
                      }}
                    />
                  )
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No products match"
                    description="Try adjusting your search or filter to find what you're looking for."
                    variant="filtered"
                  />
                )
              ) : filteredProducts.map((product, index) => {
                const isSavingCard = Boolean(productSavingById[product.id]);
                const isFirstItem = index === 0;
                const isLastItem = index === filteredProducts.length - 1;
                const isCardSelected = bulkIsSelected(product.id);
                const reorderDisabled = productSortMode !== 'manual' || !canReorder || bulkSelectedCount > 0;

                const categoryLabel = PRODUCT_CATEGORY_OPTIONS.find((option) => option.value === product.category)?.label ?? 'Styling';
                const updatedLabel = new Date(product.updatedAt).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
                const productStatusLine = isSavingCard ? 'Saving…' : (productStatusById[product.id] || '');

                return (
                  <article
                    key={product.id}
                    className={[
                      'admin-product-row',
                      isCardSelected ? 'admin-product-row--selected' : '',
                      product.active ? '' : 'admin-product-row--inactive',
                      product.featured ? 'admin-product-row--featured' : '',
                      bulkSelectedCount > 0 ? 'admin-product-row--bulk-mode' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-selected={isCardSelected}
                  >
                    <div className="admin-product-row__thumb">
                      <label
                        className="admin-product-row__checkbox-wrap"
                        title={isCardSelected ? `Deselect ${product.name}` : `Select ${product.name}`}
                      >
                        <input
                          type="checkbox"
                          className="admin-product-row__checkbox"
                          checked={isCardSelected}
                          onChange={() => bulkToggle(product.id)}
                          aria-label={isCardSelected ? `Deselect ${product.name}` : `Select ${product.name}`}
                        />
                      </label>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" loading="lazy" draggable={false} />
                      ) : (
                        <Package className="admin-product-row__thumb-icon" aria-hidden="true" />
                      )}
                    </div>

                    <div className="admin-product-row__identity">
                      <p className="admin-product-row__name">{product.name}</p>
                      <p className="admin-product-row__meta">
                        <span>{categoryLabel}</span>
                        <span className="admin-product-row__meta-sep" aria-hidden="true"> · </span>
                        <span title={`Updated ${updatedLabel}`}>{updatedLabel}</span>
                      </p>
                    </div>

                    <div className="admin-product-row__price-status">
                      <p className="admin-product-row__price">{formatPrice(product.pricePence)}</p>
                      <ProductStatusPill
                        on={product.active}
                        tone="active"
                        onLabel="Active"
                        offLabel="Inactive"
                        disabled={isSavingCard}
                        ariaLabel={`${product.name}: ${product.active ? 'Active' : 'Inactive'}`}
                        onClick={() => void patchProductFlags(product.id, { active: !product.active })}
                      />
                    </div>

                    <div className="admin-product-row__controls">
                      <button
                        type="button"
                        className={`admin-product-row__featured-btn${product.featured ? ' is-on' : ''}`}
                        role="switch"
                        aria-checked={product.featured}
                        aria-label={`${product.name}: ${product.featured ? 'Featured' : 'Not featured'}`}
                        disabled={isSavingCard}
                        onClick={() => void patchProductFlags(product.id, { featured: !product.featured })}
                        title={product.featured ? 'Featured' : 'Not featured'}
                      >
                        <Star width={14} height={14} strokeWidth={product.featured ? 0 : 2} style={product.featured ? { fill: 'currentColor' } : undefined} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="admin-product-row__edit-btn"
                        aria-label={`Edit ${product.name}`}
                        onClick={() => startEdit(product)}
                      >
                        <SettingsGearIcon className="admin-control-icon" aria-hidden="true" />
                      </button>

                      <div className="admin-reorder-controls admin-reorder-controls--product" role="group" aria-label={`Reorder ${product.name}`}>
                        <div className="admin-reorder-arrow-stack admin-reorder-arrow-stack--product">
                          <button
                            type="button"
                            className="admin-reorder-btn admin-reorder-btn--product"
                            aria-label={`Move ${product.name} up`}
                            disabled={reorderDisabled || isFirstItem}
                            onClick={() => moveItemUp(index)}
                          >
                            <ChevronUp width={14} height={14} strokeWidth={2.5} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="admin-reorder-btn admin-reorder-btn--product"
                            aria-label={`Move ${product.name} down`}
                            disabled={reorderDisabled || isLastItem}
                            onClick={() => moveItemDown(index)}
                          >
                            <ChevronDown width={14} height={14} strokeWidth={2.5} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {productStatusLine ? (
                      <p className="admin-product-row__saving-line" aria-live="polite">{productStatusLine}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>

          </div>

          <BulkActionBar
            count={bulkSelectedCount}
            loading={bulkLoading}
            onActivate={() => { void bulkPatchActive(true); }}
            onDeactivate={() => { void bulkPatchActive(false); }}
            onClear={bulkClearAll}
          />
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="admin-orders-panel">
          {error ? (
            <div className="admin-inline-error" role="alert">
              <p>{error}</p>
              {!ordersLoading ? (
                <button type="button" className="btn btn--secondary" onClick={() => { void fetchOrders(); }}>
                  Retry orders
                </button>
              ) : null}
            </div>
          ) : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}


          {ordersUnauthorized ? (


            <div className="admin-inline-error" role="alert">
              <p>Session expired — please log in again.</p>
              <a href="/admin" className="btn btn--secondary">Go to admin login</a>
            </div>
          ) : null}

          {showRetailWalkthroughComplete ? (
            <div className="admin-retail-walkthrough-complete" role="status">
              <h3>Retail setup complete</h3>
              <p>
                You’ve completed your first test order and experienced the full in-store pickup
                workflow.
              </p>
              <a className="btn btn--primary" href="/admin">
                Continue to Admin
              </a>
            </div>
          ) : walkthroughOrder &&
            (walkthroughOrder.status === 'PAID' ||
              walkthroughOrder.status === 'READY_FOR_PICKUP') ? (
            <RetailOnboardingTaskCard
              product={null}
              testOrderId={walkthroughOrder.id}
              mode="collect"
              source="admin-orders"
            />
          ) : null}

          <OrdersDataTable22
            orders={filteredOrders}
                        isMobileView={isMobileOrdersView}
            expandedOrderId={expandedOrderId}
            onToggleExpand={toggleOrderExpand}
            orderDetailsById={orderDetailsById}
            orderDetailsLoadingId={orderDetailsLoadingId}
            onMarkCollected={(orderId) => void markCollected(orderId)}
            highlightedOrderId={highlightedOrderId}
            walkthroughOrderId={walkthroughOrderId}
            onOpenClientProfile={(contact) => void handleOpenClientProfile(contact)}
            ordersUnauthorized={ordersUnauthorized}
                        emptyMessage={debouncedOrdersSearchQuery ? 'No orders match your search.' : 'No orders yet.'}
            searchSlot={
              <div className="admin-orders-search-row admin-clients-search-row">
                <div className="admin-search-bar" role="search">
                  <Search className="admin-search-bar__icon" width={16} height={16} aria-hidden="true" />
                  <input
                    type="search"
                    className="admin-search-bar__input"
                    value={ordersSearchQuery}
                    onChange={(event) => setOrdersSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Escape') return;
                      event.preventDefault();
                      setOrdersSearchQuery('');
                      setDebouncedOrdersSearchQuery('');
                    }}
                    placeholder={ordersLoading ? 'Loading…' : 'Search orders...'}
                    aria-label="Search orders"
                    disabled={ordersLoading}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {!ordersLoading ? (
                    <span className="admin-orders-search-count" aria-live="polite">
                      {filteredOrders.length} / {ordersSafe.length}
                    </span>
                  ) : null}
                  {ordersSearchQuery ? (
                    <button
                      type="button"
                      className="admin-search-bar__clear"
                      onClick={() => {
                        setOrdersSearchQuery('');
                        setDebouncedOrdersSearchQuery('');
                      }}
                      aria-label="Clear order search"
                    >
                      <X width={14} height={14} aria-hidden="true" />
                    </button>
                  ) : null}
                  {!ordersSearchQuery && !ordersLoading ? (
                    <kbd className="admin-search-bar__kbd">/</kbd>
                  ) : null}
                </div>
              </div>
            }
          />

        </div>
      )}
      {activeTab === 'sales' && (
        <div className="admin-reports admin-sales-panel">
          {salesError ? (
            <div className="admin-inline-error" role="alert">
              <p>{salesError}</p>
              {!salesLoading ? (
                <button type="button" className="btn btn--secondary" onClick={() => { void fetchSales(); }}>
                  Retry sales
                </button>
              ) : null}
            </div>
          ) : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}

          <AdminAnalyticsStudio
            toolbar={(
              <AdminSegmentedRangeControl
                options={SALES_RANGE_OPTIONS}
                value={salesSegmentedValue}
                onChange={applyPreset}
                customRange={salesRangeForPicker}
                isMobileViewport={isMobileSalesView}
                timezone={SALES_TIMEZONE}
                onCustomRangeChange={handleSalesCustomRangeChange}
                ariaLabel="Sales range presets"
              />
            )}
            toolbarSecondary={(
              <AdminSegmentedControl
                options={SALES_METRIC_OPTIONS}
                value={salesMetric}
                onChange={setSalesMetric}
                ariaLabel="Sales metric toggle"
                size="compact"
              />
            )}
            headlineValue={salesLoading && !salesData ? '—' : salesHeroValue}
            headlineLabel={salesHeroLabel}
            headlineDelta={
              salesKpiDeltas ? (
                <span className={`admin-kpi-trend ${salesMetric === 'revenue' ? salesKpiDeltas.revenue.className : salesKpiDeltas.orders.className}`}>
                  {salesMetric === 'revenue' ? salesKpiDeltas.revenue.text : salesKpiDeltas.orders.text}
                </span>
              ) : null
            }
            chart={(
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
                  <AdminLineChart
                    series={adminChartSeries}
                    metric={salesMetric === 'revenue' ? 'currency' : 'number'}
                    getColor={getSeriesColor}
                    getStrokeWidth={getSeriesStrokeWidth}
                    formatValue={fmtSalesValue}
                    primarySeriesKey={activeSeriesKeys[0]}
                    showArea={(key) => key === activeSeriesKeys[0]}
                    onExpand={isMobileSalesView ? () => setIsSalesChartExpanded(true) : undefined}
                    responsive={isMobileSalesView}
                    emptyNode={(
                      <>
                        <p>No products selected</p>
                        <p>Enable a product below to display data.</p>
                      </>
                    )}
                  />
                </SalesChartErrorBoundary>
              </div>
            )}
            footer={(
              <AdminChartLegend
                items={legendSeries}
                onRemove={removeSeriesSelection}
                hint={
                  selectionLimitMessage
                    ? SALES_SELECTION_LIMIT_MESSAGE
                    : chartSeries.length === 0
                      ? 'Select a product to display data'
                      : null
                }
                addControl={(
                  <div className="admin-chart-legend__add">
                    <button
                      type="button"
                      className="admin-chart-legend__add-btn"
                      onClick={() => setProductAddOpen((open) => !open)}
                      aria-expanded={productAddOpen}
                    >
                      + Add product
                    </button>
                    {productAddOpen ? (
                      <div className="admin-chart-legend__search-panel">
                        <input
                          type="search"
                          className="admin-chart-legend__search-input"
                          value={expandedProductSearch}
                          onChange={(event) => setExpandedProductSearch(event.target.value)}
                          placeholder="Search products"
                          aria-label="Search products"
                          autoFocus={!isMobileSalesView}
                        />
                        <div className="admin-chart-legend__search-results" role="list">
                          {filteredExpandableProducts.map((series) => (
                            <button
                              key={`search-${series.key}`}
                              type="button"
                              className="admin-chart-legend__search-result"
                              role="listitem"
                              onClick={() => {
                                handleAddSeriesSelection(series.key);
                                setProductAddOpen(false);
                              }}
                            >
                              <span className="admin-chart-legend__swatch" style={{ background: series.color }} aria-hidden="true" />
                              <span>{series.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              />
            )}
            statsRow={salesData ? (
              <>
                <p className="admin-analytics-studio__stat">
                  Orders <strong>{salesData.kpis.ordersCount}</strong>
                </p>
                <p className="admin-analytics-studio__stat">
                  AOV <strong>{formatPrice(salesData.kpis.avgOrderValuePence)}</strong>
                </p>
                <p className="admin-analytics-studio__stat">
                  Top <strong>{salesData.kpis.bestProduct?.name ?? '—'}</strong>
                </p>
              </>
            ) : null}
          />

          {isMobileSalesView && isSalesChartExpanded ? (
            <div className="admin-sales-modal" role="dialog" aria-modal="true" aria-labelledby="admin-sales-modal-title">
              <button type="button" className="admin-sales-modal-backdrop" onClick={() => setIsSalesChartExpanded(false)} aria-label="Close expanded chart" />
              <div className="admin-sales-modal-panel">
                <div className="admin-sales-modal-header">
                  <p id="admin-sales-modal-title">Sales chart</p>
                  <button type="button" className="btn btn--secondary" onClick={() => setIsSalesChartExpanded(false)}>Close</button>
                </div>
                <SalesChartErrorBoundary>
                  <AdminLineChart
                    series={adminChartSeries}
                    metric={salesMetric === 'revenue' ? 'currency' : 'number'}
                    getColor={getSeriesColor}
                    getStrokeWidth={getSeriesStrokeWidth}
                    formatValue={fmtSalesValue}
                    primarySeriesKey={activeSeriesKeys[0]}
                    showArea={(key) => key === activeSeriesKeys[0]}
                    isFullscreen
                    responsive
                    emptyNode={(
                      <>
                        <p>No products selected</p>
                        <p>Enable a product below to display data.</p>
                      </>
                    )}
                  />
                </SalesChartErrorBoundary>
              </div>
            </div>
          ) : null}

          <AdminLeaderboard
            title="Product leaderboard"
            emptyLabel="No paid order items in this range."
            rows={salesLeaderboardRows}
          />
        </div>
      )}

      {openClientId ? (
        <ClientProfilePanel clientId={openClientId} onClose={() => setOpenClientId(null)} />
      ) : null}

      </section>
    </ShopPanelErrorBoundary>

  );
}
