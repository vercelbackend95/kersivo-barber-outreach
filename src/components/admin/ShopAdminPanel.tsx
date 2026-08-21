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
import { ChevronDown, Package, Plus, Search, Star, X } from '../lucide-react';
import { formatDelta } from './reportsFormatting';
import { SkeletonBookingChoices } from '../skeleton';
import { AdminFetchError, adminFetchJson, isPublicAdminDemoMode, notifyAdminDemoBlocked } from './adminAuth';
import { resolveClientIdForBooking } from '../../lib/admin/resolveClientIdForBooking';
import RetailOnboardingWelcome from './retail-onboarding/RetailOnboardingWelcome';
import RetailOnboardingTaskCard from './retail-onboarding/RetailOnboardingTaskCard';
import BlacklineRetailTaskCard from './BlacklineRetailTaskCard';
import BlacklineDemoSaleCard from './BlacklineDemoSaleCard';
import ProductWizard from './product-wizard/ProductWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import AdminPremiumSearchBar from './AdminPremiumSearchBar';
import { normalizeProductFlags } from '@/lib/products/normalizeProductFlags';
import {
  EMPTY_PRODUCT_FORM,
  PRODUCT_CATEGORY_OPTIONS,
  type ProductCategory,
  type ProductForm
} from './product-wizard/productWizardTypes';
import { applyBlacklineRetailFocusCleanup } from '@/lib/admin/demoConfig';
import {
  completeBlacklineRetailJourney,
  getBlacklineRetailJourney,
  getBlacklineSessionOrder,
  isBlacklineSessionOrderId,
  listBlacklineSessionOrders,
  mergeBlacklineSessionOrders,
  mergeBlacklineSessionSales,
  toAdminOrderDetail,
} from '@/lib/demo/blacklineSessionOrders';
import { prefersReducedMotion } from '@/lib/landing/liveTimelineScroll';

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


type ProductFilter = 'all' | 'active' | 'inactive' | 'featured';
type ProductSortMode = 'newest' | 'price' | 'name';

const PRODUCT_SORT_OPTIONS: Array<{ value: ProductSortMode; label: string }> = [
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



const SORT_ORDER_MIN = 0;
const SORT_ORDER_MAX = 9999;
const MOBILE_PRODUCT_EDITOR_MEDIA_QUERY = '(max-width: 47.99rem)';

const DEFAULT_PRODUCT_SERIES_COLOR = 'var(--border)';

const SALES_RANGE_OPTIONS = [
  { value: '7' as const, label: '7 days' },
  { value: '30' as const, label: '30 days' },
  { value: '90' as const, label: '90 days' },
];

const SALES_TIMEZONE = 'Europe/London';

const SALES_METRIC_OPTIONS = [
  { value: 'revenue' as const, label: 'Sales £' },
  { value: 'units' as const, label: 'Units' },
];

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
          aria-label={`Set live ${count} selected products`}
        >
          {loading ? <span className="admin-bulk-spinner" aria-hidden="true" /> : null}
          Set live
        </button>
        <button
          type="button"
          className="btn btn--secondary admin-bulk-bar__btn"
          disabled={loading || count === 0}
          onClick={onDeactivate}
          aria-label={`Hide ${count} selected products`}
        >
          Hide
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
  isBlacklineDemo?: boolean;
};

const RETAIL_WALKTHROUGH_COMPLETE_DISMISSED_KEY = 'kersivo:retail-walkthrough-complete-dismissed';

function retailWalkthroughCompleteDismissedKey(orderId: string) {
  return `${RETAIL_WALKTHROUGH_COMPLETE_DISMISSED_KEY}:${orderId}`;
}

function isRetailWalkthroughCompleteDismissed(orderId: string | null | undefined): boolean {
  if (!orderId || typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(retailWalkthroughCompleteDismissedKey(orderId)) === '1';
  } catch {
    return false;
  }
}

function markRetailWalkthroughCompleteDismissed(orderId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(retailWalkthroughCompleteDismissedKey(orderId), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

function readRetailDeepLinkFromUrl(): { orderId: string | null; demoJourney: string | null } {
  if (typeof window === 'undefined') return { orderId: null, demoJourney: null };
  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get('order')?.trim() || null,
    demoJourney: params.get('demoJourney')?.trim() || null,
  };
}

function clearRetailFocusParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const next = applyBlacklineRetailFocusCleanup(window.location.href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  window.history.replaceState(window.history.state, '', next);
}

export default function ShopAdminPanel({ initialTab = 'products', isBlacklineDemo = false }: ShopAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>(initialTab);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wizardInitialForm, setWizardInitialForm] = useState<ProductForm | undefined>(undefined);
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
  const retailFocusConsumedRef = useRef(false);
  const salesFocusConsumedRef = useRef(false);
  const retailDeepLinkRef = useRef<string | null>(
    isBlacklineDemo && readRetailDeepLinkFromUrl().demoJourney === 'retail'
      ? readRetailDeepLinkFromUrl().orderId
      : null,
  );

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

  const [expandedProductSearch, setExpandedProductSearch] = useState('');
  const [productAddOpen, setProductAddOpen] = useState(false);
  useBodyScrollLock(formOpen && isMobileProductEditor);

  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productSortMode, setProductSortMode] = useState<ProductSortMode>('name');
  const [productSortOpen, setProductSortOpen] = useState(false);
  const [productSavingById, setProductSavingById] = useState<Record<string, boolean>>({});
  const [productStatusById, setProductStatusById] = useState<Record<string, string>>({});
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

  const resetForm = useCallback(() => {
    setEditingId(null);
    setWizardInitialForm(undefined);
    setFormOpen(false);
  }, []);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );
  

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(MOBILE_PRODUCT_EDITOR_MEDIA_QUERY);
    const handleChange = () => {
      setIsMobileSalesView(mediaQuery.matches);
      setIsMobileProductEditor(mediaQuery.matches);
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

  const baseProducts = useMemo(() => {
    const source = [...sortedProducts];
    if (productSortMode === 'newest') {
      return source.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }
    if (productSortMode === 'price') {
      return source.sort((a, b) => b.pricePence - a.pricePence || a.name.localeCompare(b.name));
    }
    return source.sort((a, b) => a.name.localeCompare(b.name));
  }, [productSortMode, sortedProducts]);

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
  const defaultSortOrder = useMemo(() => Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, products.length)), [products.length]);
  const productsInitiallyLoading = loading && products.length === 0;




  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!formOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetForm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, resetForm]);

  useEffect(() => {
    bulkClearAll();
  }, [productFilter, productSearch, productSortMode]);



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

  const sessionOrderIds = useMemo(
    () => (isBlacklineDemo ? new Set(listBlacklineSessionOrders().map((row) => row.id)) : new Set<string>()),
    [isBlacklineDemo, ordersSafe],
  );

  const retailJourney = isBlacklineDemo ? getBlacklineRetailJourney() : null;
  const retailJourneyOrder = retailJourney ? getBlacklineSessionOrder(retailJourney.orderId) : null;
  const showBlacklineRetailTask =
    isBlacklineDemo &&
    activeTab === 'orders' &&
    Boolean(retailJourneyOrder) &&
    (retailJourney?.stage === 'collect' || retailJourney?.stage === 'view_sale');
  const focusedSaleOrder =
    isBlacklineDemo && activeTab === 'sales' && retailDeepLinkRef.current
      ? getBlacklineSessionOrder(retailDeepLinkRef.current)
      : null;

  useEffect(() => {
    if (walkthroughOrder?.status !== 'COLLECTED') return;
    if (isBlacklineSessionOrderId(walkthroughOrder.id)) return;
    if (isRetailWalkthroughCompleteDismissed(walkthroughOrder.id)) {
      setShowRetailWalkthroughComplete(false);
      return;
    }
    setShowRetailWalkthroughComplete(true);
  }, [walkthroughOrder?.status, walkthroughOrder?.id]);

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
    const demoJourney = params.get('demoJourney')?.trim();
    const retailWalkthrough = params.get('retailWalkthrough') === '1';
    if (!orderId) return;
    if (isBlacklineDemo && demoJourney === 'retail') return;

    setHighlightedOrderId(orderId);
    if (retailWalkthrough) {
      setWalkthroughOrderId(orderId);
    }
    setExpandedOrderId(orderId);
    void fetchOrderDetails(orderId);

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`admin-order-${orderId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 350);

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedOrderId((current) => (current === orderId ? null : current));
    }, 8000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [activeTab, ordersLoading, isBlacklineDemo]);

  useEffect(() => {
    if (!isBlacklineDemo || activeTab !== 'orders' || ordersLoading) return;
    const orderId = retailDeepLinkRef.current;
    if (!orderId || retailFocusConsumedRef.current) return;
    if (!isBlacklineSessionOrderId(orderId)) return;
    if (!orders.some((order) => order.id === orderId)) return;

    retailFocusConsumedRef.current = true;
    setOrdersSearchQuery('');
    setDebouncedOrdersSearchQuery('');
    setHighlightedOrderId(orderId);
    setExpandedOrderId(orderId);
    void fetchOrderDetails(orderId);

    const reducedMotion = prefersReducedMotion();
    const scrollTimer = window.setTimeout(() => {
      const row = document.getElementById(`admin-order-${orderId}`);
      row?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      clearRetailFocusParamsFromUrl();
    }, reducedMotion ? 0 : 350);

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedOrderId((current) => (current === orderId ? null : current));
    }, 8000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [activeTab, isBlacklineDemo, ordersLoading]);

  useEffect(() => {
    if (!isBlacklineDemo || activeTab !== 'sales') return;
    const orderId = retailDeepLinkRef.current;
    if (!orderId || salesFocusConsumedRef.current) return;
    if (!isBlacklineSessionOrderId(orderId)) return;

    salesFocusConsumedRef.current = true;
    const reducedMotion = prefersReducedMotion();
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`admin-demo-sale-${orderId}`)?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
      clearRetailFocusParamsFromUrl();
      completeBlacklineRetailJourney(orderId);
    }, reducedMotion ? 0 : 350);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [activeTab, isBlacklineDemo]);


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

  async function patchProductFlags(productId: string, patch: { active?: boolean; featured?: boolean }) {
    const existing = products.find((product) => product.id === productId);
    if (!existing) return;

    const normalized = normalizeProductFlags(
      { active: existing.active, featured: existing.featured },
      patch
    );
    const previousProducts = products;
    setProductSavingById((previous) => ({ ...previous, [productId]: true }));
    setProductStatusById((previous) => ({ ...previous, [productId]: 'Saving…' }));
    setProducts((previous) =>
      previous.map((product) =>
        product.id === productId
          ? { ...product, active: normalized.active, featured: normalized.featured }
          : product
      )
    );

    try {
      const payload = await adminFetchJson<{ product: Product }>(`/api/admin/shop/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        errorMessage: 'Unable to update product.',
      });
      setProducts((previous) =>
        previous.map((product) => (product.id === productId ? (payload.product as Product) : product))
      );
      setProductStatusById((previous) => ({ ...previous, [productId]: 'Saved' }));
      window.setTimeout(() => {
        setProductStatusById((previous) => {
          const next = { ...previous };
          delete next[productId];
          return next;
        });
      }, 900);
      setError(null);
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
      const body = active ? { active: true } : { active: false, featured: false };
      const results = await Promise.allSettled(
        ids.map((id) =>
          adminFetchJson<{ product: Product }>(`/api/admin/shop/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            errorMessage: 'Unable to update product.',
          })
        )
      );

      const succeeded: Product[] = [];
      let failedCount = 0;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.product) {
          succeeded.push(result.value.product as Product);
        } else {
          failedCount += 1;
        }
      }

      if (succeeded.length > 0) {
        const byId = new Map(succeeded.map((product) => [product.id, product]));
        setProducts((previous) =>
          previous.map((product) => byId.get(product.id) ?? product)
        );
      }

      if (failedCount > 0) {
        setError(`${succeeded.length} updated, ${failedCount} failed.`);
        return;
      }

      bulkClearAll();
      setSuccess(
        `${ids.length} product${ids.length !== 1 ? 's' : ''} ${active ? 'set live' : 'hidden'}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk operation failed.');
    } finally {
      setBulkLoading(false);
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
      const incoming = payload.orders as OrderListItem[];
      setOrders(isBlacklineDemo ? mergeBlacklineSessionOrders(incoming) : incoming);
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
    if (isBlacklineDemo) {
      const session = getBlacklineSessionOrder(orderId);
      if (session) {
        const detail = toAdminOrderDetail(session) as OrderDetail;
        setOrderDetailsById((previous) => ({ ...previous, [detail.id]: detail }));
        return;
      }
    }
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
      const next = isBlacklineDemo
        ? mergeBlacklineSessionSales(payload as SalesResponse)
        : (payload as SalesResponse);
      setSalesData(next);
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
          retailPickupWalkthroughCompletedAt?: string | null;
          via?: string;
        };
        // Keep setup prompt until full journey end (pickup walkthrough). Skip/abort must not dismiss it.
        const hidePrompt =
          payload.via !== 'session' || Boolean(payload.retailPickupWalkthroughCompletedAt);
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


  function startCreate() {
    if (isPublicAdminDemoMode()) {
      notifyAdminDemoBlocked();
      return;
    }
    setEditingId(null);
    setWizardInitialForm({
      ...EMPTY_PRODUCT_FORM,
      sortOrder: defaultSortOrder
    });
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function startEdit(product: Product) {
    if (isPublicAdminDemoMode()) {
      notifyAdminDemoBlocked();
      return;
    }
    const normalizedSortOrder = Number.isFinite(product.sortOrder)
      ? Math.min(SORT_ORDER_MAX, Math.max(SORT_ORDER_MIN, product.sortOrder))
      : defaultSortOrder;

    setEditingId(product.id);
    setWizardInitialForm({
      name: product.name,
      description: product.description || '',
      priceGbp: (product.pricePence / 100).toFixed(2),
      imageUrl: product.imageUrl || '',
      active: product.active,
      featured: product.featured,
      category: product.category,
      sortOrder: normalizedSortOrder
    });
    setFormOpen(true);
    setError(null);
    setSuccess(null);
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
      if (
        walkthroughOrderId === orderId &&
        !isRetailWalkthroughCompleteDismissed(orderId) &&
        !isBlacklineSessionOrderId(orderId)
      ) {
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
          : activeTab === 'sales' ? 'Sales trends'
          : 'Retail product catalogue'
        }
        metaBadge={
          activeTab === 'products'
            ? `${products.length} products`
            : undefined
        }
        metaBadges={activeTab === 'orders' ? [
          { label: `${paidOrdersCount} to collect`, variant: 'info' },
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
              <AdminPremiumSearchBar
                className="admin-products-toolbar-search"
                inputRef={productSearchInputRef}
                value={productSearch}
                onChange={setProductSearch}
                onClear={handleProductSearchClear}
                onKeyDown={(e) => e.key === 'Escape' && handleProductSearchClear()}
                placeholder="Search products…"
                aria-label="Search products"
                showKbdHint
                searchShortcutHint="/"
              />

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
                        {filter === 'all' ? 'All' : filter === 'active' ? 'Live' : filter === 'inactive' ? 'Hidden' : 'Featured'}
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

          <AdminWizardSheetLayer
            open={formOpen}
            onDismiss={resetForm}
            ariaLabelledBy="admin-product-form-title"
            className="admin-product-sheet-layer"
          >
            <ProductWizard
              key={editingId ?? 'create'}
              mode={editingId ? 'edit' : 'create'}
              productId={editingId ?? undefined}
              initialForm={wizardInitialForm}
              onCancel={resetForm}
              onSaved={async () => {
                await fetchProducts();
              }}
            />
          </AdminWizardSheetLayer>

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
              ) : filteredProducts.map((product) => {
                const isSavingCard = Boolean(productSavingById[product.id]);
                const isCardSelected = bulkIsSelected(product.id);

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
                        onLabel="Live"
                        offLabel="Hidden"
                        disabled={isSavingCard}
                        ariaLabel={`${product.name}: ${product.active ? 'Live' : 'Hidden'}`}
                        onClick={() => void patchProductFlags(product.id, { active: !product.active })}
                      />
                    </div>

                    <div className="admin-product-row__featured-col">
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
                    </div>

                    <div className="admin-product-row__controls">
                      <button
                        type="button"
                        className="admin-product-row__edit-btn"
                        aria-label={
                          isPublicAdminDemoMode()
                            ? 'Product settings — sample data is read-only'
                            : `Edit ${product.name}`
                        }
                        title={
                          isPublicAdminDemoMode()
                            ? 'Product settings — sample data is read-only'
                            : `Edit ${product.name}`
                        }
                        onClick={() => startEdit(product)}
                      >
                        <SettingsGearIcon className="admin-control-icon" aria-hidden="true" />
                      </button>
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

          {showBlacklineRetailTask && retailJourney && retailJourneyOrder ? (
            <BlacklineRetailTaskCard
              stage={retailJourney.stage === 'view_sale' ? 'view_sale' : 'collect'}
              orderId={retailJourneyOrder.id}
              compact
            />
          ) : showRetailWalkthroughComplete ? (
            <div className="admin-retail-walkthrough-complete" role="status">
              <h3>Retail setup complete</h3>
              <p>
                You’ve completed your first test order and experienced the full in-store pickup
                workflow.
              </p>
              <p>You can track this sale (and future ones) in the Sales tab.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (walkthroughOrderId) {
                    markRetailWalkthroughCompleteDismissed(walkthroughOrderId);
                  }
                  setShowRetailWalkthroughComplete(false);
                  setActiveTab('sales');
                }}
              >
                Check Sales
              </button>
            </div>
          ) : walkthroughOrder &&
            (walkthroughOrder.status === 'PAID' ||
              walkthroughOrder.status === 'READY_FOR_PICKUP') ? (
            <RetailOnboardingTaskCard
              product={null}
              testOrderId={walkthroughOrder.id}
              mode="collect"
              source="admin-orders"
              compact
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
            onLoadOrderDetails={(orderId) => void fetchOrderDetails(orderId)}
            highlightedOrderId={highlightedOrderId}
            walkthroughOrderId={walkthroughOrderId}
            sessionOrderIds={sessionOrderIds}
            onOpenClientProfile={(contact) => void handleOpenClientProfile(contact)}
            ordersUnauthorized={ordersUnauthorized}
                        emptyMessage={debouncedOrdersSearchQuery ? 'No orders match your search.' : 'No orders yet.'}
            searchSlot={
              <div className="admin-orders-search-row admin-clients-search-row">
                <AdminPremiumSearchBar
                  value={ordersSearchQuery}
                  onChange={setOrdersSearchQuery}
                  onClear={() => {
                    setOrdersSearchQuery('');
                    setDebouncedOrdersSearchQuery('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    setOrdersSearchQuery('');
                    setDebouncedOrdersSearchQuery('');
                  }}
                  placeholder={ordersLoading ? 'Loading…' : 'Search orders...'}
                  aria-label="Search orders"
                  disabled={ordersLoading}
                  resultsLabel={
                    !ordersLoading ? `${filteredOrders.length} / ${ordersSafe.length}` : undefined
                  }
                  showKbdHint={!ordersLoading}
                  searchShortcutHint="/"
                />
              </div>
            }
          />

        </div>
      )}
      {activeTab === 'sales' && (
        <div className="admin-reports admin-sales-panel">
          {focusedSaleOrder ? <BlacklineDemoSaleCard order={focusedSaleOrder} /> : null}
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
            headlineValue={
              salesLoading && !salesData
                ? <span className="admin-analytics-studio__headline-skeleton" aria-hidden="true" />
                : <span data-blackline-sales-revenue={salesMetric === 'revenue' ? String(salesData?.kpis.revenuePence ?? 0) : undefined}>{salesHeroValue}</span>
            }
            headlineDelta={
              salesKpiDeltas ? (
                <span className={`admin-kpi-trend admin-analytics-studio__headline-delta ${salesMetric === 'revenue' ? salesKpiDeltas.revenue.className : salesKpiDeltas.orders.className}`}>
                  {salesMetric === 'revenue' ? salesKpiDeltas.revenue.text : salesKpiDeltas.orders.text}
                </span>
              ) : null
            }
            chart={(
              <div className="admin-sales-chart-wrap">
                <SalesChartErrorBoundary>
                  <AdminLineChart
                    series={adminChartSeries}
                    metric={salesMetric === 'revenue' ? 'currency' : 'number'}
                    getColor={getSeriesColor}
                    getStrokeWidth={getSeriesStrokeWidth}
                    formatValue={fmtSalesValue}
                    primarySeriesKey={activeSeriesKeys[0]}
                    showArea={(key) => key === activeSeriesKeys[0]}
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
