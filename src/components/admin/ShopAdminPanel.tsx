import React, { useEffect, useMemo, useRef, useState } from 'react';

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

type DragState = {
  id: string;
  pointerId: number;
  pointerY: number;
  overId: string;
};

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



const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  priceGbp: '',
  imageUrl: '',
  active: true,
  featured: false,
  sortOrder: 0
};

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


function MiniLineChart({ series, metric }: { series: SalesChartSeries[]; metric: SalesMetric }) {
  if (series.length === 0 || series.every((line) => line.points.length === 0)) {
    return (
      <div className="admin-sales-empty">
        <p>No sales yet.</p>
      </div>
    );
  }

  const width = 900;

  const height = 320;
  const padding = { top: 20, right: 20, bottom: 36, left: 54 };
  const colors = ['var(--accent)', 'var(--fg)', 'var(--muted)', 'var(--accent-hover)'];

  const safeSeries = series
    .map((line) => ({ ...line, points: line.points ?? [] }))
    .filter((line) => line.points.length > 0);

  if (safeSeries.length === 0) {
    return (
      <div className="admin-sales-empty">
        <p>No sales yet.</p>
      </div>
    );
  }

  const allPoints = safeSeries.flatMap((line) => line.points);

  const allDates = Array.from(new Set(allPoints.map((point) => point.date))).sort((a, b) => a.localeCompare(b));
  const values = allPoints.map((point) => (metric === 'revenue' ? point.revenuePence : point.units));
  const maxValue = values.length > 0 ? Math.max(0, ...values) : 0;
  const yMax = Math.max(maxValue, metric === 'revenue' ? 100 : 1);


  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xPosition = (date: string): number => {
    const index = allDates.indexOf(date);
    if (index <= 0 || allDates.length <= 1) return padding.left;
    return padding.left + (index / (allDates.length - 1)) * innerWidth;
  };

  const yPosition = (value: number): number => padding.top + (1 - value / yMax) * innerHeight;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, index) => (yMax / ticks) * index);
  const formatAxisValue = (value: number): string => (metric === 'revenue' ? `£${(value / 100).toFixed(2)}` : `${Math.round(value)}`);
  const formatTooltipValue = (value: number): string => (metric === 'revenue' ? formatPrice(value) : `${Math.round(value)} units`);


  return (
    <div className="admin-sales-chart-inner">
      <svg
        viewBox={`0 0 ${width} ${height}`}
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

        {safeSeries.map((line, lineIndex) => {
          const path = line.points
            .map((point, pointIndex) => {
              const value = metric === 'revenue' ? point.revenuePence : point.units;
              return `${pointIndex === 0 ? 'M' : 'L'} ${xPosition(point.date)} ${yPosition(value)}`;
            })

          .join(' ');

          return (
            <g key={line.key}>
              <path d={path} fill="none" stroke={colors[lineIndex % colors.length]} strokeWidth="2" />
              {line.points.map((point) => {
                const value = metric === 'revenue' ? point.revenuePence : point.units;
                return (
                  <circle key={`${line.key}-${point.date}`} cx={xPosition(point.date)} cy={yPosition(value)} r="2.25" fill={colors[lineIndex % colors.length]}>
                    <title>{`${new Date(`${point.date}T00:00:00`).toLocaleDateString('en-GB')} · ${line.name}: ${formatTooltipValue(value)}`}</title>
                  </circle>
                );
              })}

            </g>
          );
        })}

        {allDates.filter((_, index) => index % Math.max(1, Math.ceil(allDates.length / 6)) === 0 || index === allDates.length - 1).map((date) => (
          <text key={`x-${date}`} x={xPosition(date)} y={height - 12} textAnchor="middle" className="admin-sales-axis-label">
            {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
      </svg>

      <div className="admin-sales-legend">
        {safeSeries.map((line, index) => (
          <span key={`legend-${line.key}`} className="admin-sales-legend-item">
            <i style={{ background: colors[index % colors.length] }} />{line.name}
          </span>
        ))}
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
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [ordersUnauthorized, setOrdersUnauthorized] = useState(false);

  const [salesPreset, setSalesPreset] = useState<SalesRangePreset>('30');
  const [salesFrom, setSalesFrom] = useState(() => getRangeDates('30').from);
  const [salesTo, setSalesTo] = useState(() => getCurrentYmdInLondon());
  const [includeOverall, setIncludeOverall] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [salesMetric, setSalesMetric] = useState<SalesMetric>('revenue');
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);

    const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productSortMode, setProductSortMode] = useState<ProductSortMode>('manual');
  const [manualOrderIds, setManualOrderIds] = useState<string[]>([]);
  const [productSavingById, setProductSavingById] = useState<Record<string, boolean>>({});
  const [productStatusById, setProductStatusById] = useState<Record<string, string>>({});
  const [formInitial, setFormInitial] = useState<ProductFormState>(EMPTY_FORM);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragPressTimerRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const dragLatestYRef = useRef(0);
  const pendingOrderBeforeSaveRef = useRef<string[]>([]);


  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );
  

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

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
    if (!dragState) return;
    const previousTouchAction = document.body.style.touchAction;
    const previousOverflow = document.body.style.overflow;
    document.body.style.touchAction = 'none';
    document.body.style.overflow = 'hidden';

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      dragLatestYRef.current = event.clientY;
      if (dragRafRef.current) return;
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null;
        const pointerY = dragLatestYRef.current;
        let overId = dragState.overId;
        for (const product of manualProducts) {
          const element = dragCardRefs.current[product.id];
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          if (pointerY >= rect.top && pointerY <= rect.bottom) {
            overId = product.id;
            break;
          }
        }
        setDragState((previous) => (previous ? { ...previous, pointerY, overId } : previous));
        setManualOrderIds((previous) => {
          const fromIndex = previous.indexOf(dragState.id);
          const toIndex = previous.indexOf(overId);
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return previous;
          const next = [...previous];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return next;
        });
      });
    };

    const handleUp = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      void saveManualOrder();
      setDragState(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp, { passive: true });
    window.addEventListener('pointercancel', handleUp, { passive: true });

    return () => {
      if (dragRafRef.current) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      document.body.style.touchAction = previousTouchAction;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragState, manualProducts]);


    const activeSectionLabel = useMemo(() => {
    if (activeTab === 'orders') return 'Orders';
    if (activeTab === 'sales') return 'Sales';
    return 'Products';
  }, [activeTab]);



  const chartSeries = useMemo(() => {
    if (!salesData) return [] as SalesChartSeries[];

    const lines: SalesChartSeries[] = [];

    if (includeOverall && salesData.series.overall) {
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
  }, [includeOverall, salesData]);


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
        setSelectedOrder(null);
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
    try {
     const response = await fetch(`/api/admin/shop/orders/${orderId}`, { credentials: 'include' });
      const payload = await response.json();
            if (response.status === 401) {
        setSelectedOrder(null);
        setOrdersUnauthorized(true);
        return;
      }

      if (!response.ok) throw new Error(payload.error || 'Could not fetch order details.');
      setSelectedOrder(payload.order as OrderDetail);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not fetch order details.');
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

    if (selectedProductIds.length > 0) {
      query.set('productIds', selectedProductIds.join(','));
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

  async function generateDemoSales() {
    setGeneratingDemo(true);
    setSalesError(null);
    try {
      const response = await fetch('/api/admin/shop/sales/demo', { method: 'POST', credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not generate demo sales data.');
      setSuccess(typeof payload.message === 'string' ? payload.message : 'Demo sales data generated.');
      await fetchSales();
      await fetchOrders();
    } catch (generateError) {
      setSalesError(generateError instanceof Error ? generateError.message : 'Could not generate demo sales data.');
    } finally {
      setGeneratingDemo(false);
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
  }, [activeTab, salesPreset, salesFrom, salesTo, selectedProductIds.join(',')]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    const intervalId = window.setInterval(() => {
      void fetchOrders();
      if (selectedOrder) {
        void fetchOrderDetails(selectedOrder.id);
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, selectedOrder]);


  function resetForm() {
    setForm(EMPTY_FORM);
        setFormInitial(EMPTY_FORM);
    setFormOpen(false);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
        setFormInitial(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function startEdit(product: Product) {
    const nextForm = {
      id: product.id,
      name: product.name,
      description: product.description || '',
      priceGbp: (product.pricePence / 100).toFixed(2),
      imageUrl: product.imageUrl || '',
      active: product.active,
      featured: product.featured,
      sortOrder: product.sortOrder
          };
    setForm(nextForm);
    setFormInitial(nextForm);

    setFormOpen(true);
    setError(null);
    setSuccess(null);
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

          sortOrder: form.sortOrder
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save product.');

      await fetchProducts();
      setSuccess(form.id ? 'Product updated.' : 'Product created.');
      resetForm();
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
      if (!response.ok) throw new Error(payload.error || 'Unable to disable product.');
      await fetchProducts();
      setSuccess('Product disabled.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to disable product.');
    }
  }
  
  async function saveManualOrder() {
    if (!canReorder) return;
    const orderedIds = manualOrderIds;
    if (orderedIds.length === 0) return;
    const previous = pendingOrderBeforeSaveRef.current.length > 0 ? pendingOrderBeforeSaveRef.current : sortedProducts.map((product) => product.id);

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
      setSuccess('Order saved.');
    } catch (reorderError) {
      setManualOrderIds(previous);
      setError(reorderError instanceof Error ? reorderError.message : 'Unable to save order.');
    } finally {
      pendingOrderBeforeSaveRef.current = [];
    }
  }

  function onDragPressStart(event: React.PointerEvent<HTMLButtonElement>, productId: string) {
    if (!canReorder || dragState) return;
    pendingOrderBeforeSaveRef.current = manualOrderIds;
    const pointerId = event.pointerId;
    const pointerY = event.clientY;
    dragPressTimerRef.current = window.setTimeout(() => {
      setDragState({ id: productId, pointerId, pointerY, overId: productId });
    }, 240);
  }

  function onDragPressEnd() {
    if (dragPressTimerRef.current) {
      window.clearTimeout(dragPressTimerRef.current);
      dragPressTimerRef.current = null;
    }
  }


  async function markCollected(orderId: string) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}/collect`, { method: 'POST', credentials: 'include' });
      const payload = await response.json();
      if (response.status === 401) {
        setOrdersUnauthorized(true);
        setSelectedOrder(null);
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
  function toggleProductSelection(productId: string) {
    setSelectedProductIds((previous) => {
      if (previous.includes(productId)) {
        return previous.filter((id) => id !== productId);
      }
      if (previous.length >= 3) {
        return previous;
      }
      return [...previous, productId];
    });
  }

  function applyPreset(nextPreset: Exclude<SalesRangePreset, 'custom'>) {
    const dates = getRangeDates(nextPreset);
    setSalesPreset(nextPreset);
    setSalesFrom(dates.from);
    setSalesTo(dates.to);
  }


  return (
    <section className="booking-shell" aria-live="polite">
      <h2>Shop</h2>

      <p className="admin-shop-kicker muted">{activeSectionLabel}</p>

      {activeTab === 'products' && (
        <div className="admin-reports admin-products-panel">
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
              <div className="admin-products-toolbar-actions">
                <button type="button" className="btn btn--primary" onClick={startCreate}>Add product</button>
                <select value={productSortMode} onChange={(event) => setProductSortMode(event.target.value as ProductSortMode)} className="admin-products-sort">
                  <option value="manual">Manual order</option>
                  <option value="newest">Newest</option>
                  <option value="price">Price</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
            <div className="admin-products-toolbar-row">
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
              <p className="admin-products-count muted">{filteredProducts.length} products • {featuredCount} featured</p>
            </div>
            {!canReorder && productSortMode === 'manual' ? <p className="muted">Clear search/filter to reorder manually.</p> : null}
          </div>


          {error ? <p className="admin-inline-error">{error}</p> : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}

          {formOpen ? (
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
                  {form.imageUrl.trim() ? <img src={form.imageUrl} alt="Preview" /> : <span>No image preview</span>}
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
                  <label className="admin-product-toggle"><span>Active</span><input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked, featured: event.target.checked ? prev.featured : false }))} /></label>
                  <label className="admin-product-toggle"><span>Featured</span><input type="checkbox" checked={form.featured} onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked, active: event.target.checked ? true : prev.active }))} /></label>
                </div>

                <details className="admin-product-advanced">
                  <summary>Advanced</summary>
                  <label className="admin-product-field">Sort order
                    <input type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))} />
                  </label>
                </details>

                <div className="admin-product-sheet-footer">
                  <button type="button" className="btn btn--secondary" onClick={resetForm}>Cancel</button>
                  <button type="submit" className="btn btn--primary" disabled={saving || !formValid || !formDirty}>{saving ? 'Saving...' : 'Save product'}</button>
                </div>
              </form>
            </div>

          ) : null}

          <div className="admin-products-cards">
            {filteredProducts.length === 0 ? (
              <article className="admin-product-card"><p>No products yet.</p></article>
            ) : filteredProducts.map((product) => {
              const isDragging = dragState?.id === product.id;
              const isSavingCard = Boolean(productSavingById[product.id]);
              return (
                <article
                  key={product.id}
                  className={`admin-product-card ${isDragging ? 'admin-product-card--dragging' : ''}`}
                  ref={(element) => { dragCardRefs.current[product.id] = element; }}
                >
                  <div className="admin-product-card-main">
                    <div className="admin-product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <span>No image</span>}</div>
                    <div>
                      <h4>{product.name}</h4>
                      <p className="admin-product-price">{formatPrice(product.pricePence)}</p>
                      <p className="admin-product-meta muted">Updated {new Date(product.updatedAt).toLocaleString('en-GB')} • Sort {product.sortOrder}</p>
                    </div>
                    <button
                      type="button"
                      className="admin-drag-handle"
                      aria-label={`Reorder ${product.name}`}
                      disabled={!canReorder}
                      onPointerDown={(event) => onDragPressStart(event, product.id)}
                      onPointerUp={onDragPressEnd}
                      onPointerCancel={onDragPressEnd}
                    >
                      ⋮⋮
                    </button>
                  </div>

                  <div className="admin-product-switches admin-product-switches--card">
                    <label className="admin-product-toggle"><span>Active</span><input type="checkbox" checked={product.active} disabled={isSavingCard} onChange={(event) => void patchProductFlags(product.id, { active: event.target.checked })} /></label>
                    <label className="admin-product-toggle"><span>Featured</span><input type="checkbox" checked={product.featured} disabled={isSavingCard} onChange={(event) => void patchProductFlags(product.id, { featured: event.target.checked })} /></label>
                  </div>

                  <div className="admin-products-actions">
                    <button type="button" className="btn btn--ghost" onClick={() => startEdit(product)}>Edit</button>
                    <button type="button" className="btn btn--secondary" onClick={() => void disableProduct(product.id)}>Delete</button>
                    <span className="admin-product-saving muted">{isSavingCard ? 'Saving…' : (productStatusById[product.id] || '')}</span>
                  </div>
                </article>
              );
            })}

          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="admin-reports admin-orders-panel">
          {error ? <p className="admin-inline-error">{error}</p> : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}
          <div className="admin-products-actions">
            <button type="button" className="btn btn--ghost" onClick={() => void fetchOrders()} disabled={ordersLoading}>{ordersLoading ? 'Refreshing...' : 'Refresh orders'}</button>          </div>
                    {ordersUnauthorized ? (
            <div className="admin-inline-error" role="alert">
              <p>Session expired — please log in again.</p>
              <a href="/admin" className="btn btn--secondary">Go to admin login</a>
            </div>
          ) : null}

          <div className="admin-products-table-wrap">
            <table className="admin-table">
             <thead><tr><th>Created</th><th>Paid</th><th>Customer email</th><th>Total</th><th>Status</th><th>Items</th><th>Action</th></tr></thead>              <tbody>
                {!ordersUnauthorized && orders.length === 0 ? (<tr><td colSpan={7}>No orders yet.</td></tr>) : orders.map((order) => (                  <tr key={order.id}>                    <td>{new Date(order.createdAt).toLocaleString('en-GB')}</td>
                    <td>{order.paidAt ? new Date(order.paidAt).toLocaleString('en-GB') : '—'}</td>
                    <td>{order.customerEmail}</td>
                    <td>{formatPrice(order.totalPence)}</td>
                    <td>{order.status}</td>
                    <td>{order._count.items}</td>
                    <td><button type="button" className="btn btn--ghost" onClick={() => void fetchOrderDetails(order.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedOrder ? (
            <article className="admin-order-detail">
              <h3>Order details</h3>
              <p><strong>Email:</strong> {selectedOrder.customerEmail}</p>
              <p><strong>Status:</strong> {selectedOrder.status}</p>
              <p><strong>Total:</strong> {formatPrice(selectedOrder.totalPence)}</p>
              <p><strong>Created:</strong> {new Date(selectedOrder.createdAt).toLocaleString('en-GB')}</p>
              <p><strong>Paid:</strong> {selectedOrder.paidAt ? new Date(selectedOrder.paidAt).toLocaleString('en-GB') : '—'}</p>
              <p><strong>Collected:</strong> {selectedOrder.collectedAt ? new Date(selectedOrder.collectedAt).toLocaleString('en-GB') : '—'}</p>
              <div className="admin-products-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Item</th><th>Unit</th><th>Qty</th><th>Line total</th></tr></thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id}><td>{item.nameSnapshot}</td><td>{formatPrice(item.unitPricePenceSnapshot)}</td><td>{item.quantity}</td><td>{formatPrice(item.lineTotalPence)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedOrder.status === 'PAID' ? (
                <button type="button" className="btn btn--primary" onClick={() => void markCollected(selectedOrder.id)}>Mark as collected</button>
              ) : null}
            </article>
          ) : null}
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




            <label className="admin-product-checkbox"><input type="checkbox" checked={includeOverall} onChange={(event) => setIncludeOverall(event.target.checked)} />Include Overall line</label>

            <div className="admin-sales-product-picker">
              <p>Select products (max 3):</p>
              <div className="admin-sales-product-list">
                {sortedProducts.filter((product) => product.active).map((product) => {
                  const selected = selectedProductIds.includes(product.id);
                  const limitReached = selectedProductIds.length >= 3 && !selected;
                  return (
                    <label key={product.id} className="admin-product-checkbox">
                      <input type="checkbox" checked={selected} disabled={limitReached} onChange={() => toggleProductSelection(product.id)} />
                      {product.name}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="admin-products-actions">
              <button type="button" className="btn btn--primary" onClick={() => void fetchSales()} disabled={salesLoading}>{salesLoading ? 'Loading...' : 'Refresh sales'}</button>              {import.meta.env.DEV ? (
                <button type="button" className="btn btn--secondary" onClick={() => void generateDemoSales()} disabled={generatingDemo}>{generatingDemo ? 'Generating...' : 'Generate demo sales data'}</button>              ) : null}
            </div>
          </div>

          {(salesData?.kpis.ordersCount ?? 0) === 0 || chartSeries.length === 0 ? (
            <div className="admin-sales-empty">
              <p>No sales yet.</p>
            </div>
          ) : (
            <>
              <div className="admin-sales-chart-wrap">
                <SalesChartErrorBoundary>
                  <MiniLineChart series={chartSeries} metric={salesMetric} />
                </SalesChartErrorBoundary>
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
          )}
        </div>
      )}


    </section>
  );
}
