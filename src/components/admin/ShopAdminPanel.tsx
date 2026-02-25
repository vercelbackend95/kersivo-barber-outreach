import React, { useEffect, useMemo, useState } from 'react';

type ShopTab = 'products' | 'orders' | 'sales';
type SalesRangePreset = '7' | '30' | '90' | 'custom';


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
    overall?: Array<{ date: string; revenuePence: number }>;
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
type SalesChartSeries = {
  key: string;
  name: string;
  points: Array<{ date: string; revenuePence: number }>;
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

function MiniLineChart({ series }: { series: SalesChartSeries[] }) {
  const width = 900;
  const height = 320;
  const padding = { top: 20, right: 20, bottom: 36, left: 54 };
  const colors = ['var(--accent)', 'var(--fg)', 'var(--muted)', 'var(--accent-hover)'];

  const allPoints = series.flatMap((line) => line.points);
  const allDates = Array.from(new Set(allPoints.map((point) => point.date))).sort((a, b) => a.localeCompare(b));
  const maxValue = Math.max(0, ...allPoints.map((point) => point.revenuePence));
  const yMax = Math.max(maxValue, 100);

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xPosition = (date: string): number => {
    const index = allDates.indexOf(date);
    if (index <= 0 || allDates.length <= 1) return padding.left;
    return padding.left + (index / (allDates.length - 1)) * innerWidth;
  };

  const yPosition = (value: number): number => padding.top + (1 - value / yMax) * innerHeight;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }).map((_, index) => Math.round((yMax / ticks) * (ticks - index)));

  return (
    <div className="admin-sales-chart-inner">
      <svg viewBox={`0 0 ${width} ${height}`} className="admin-sales-chart-svg" role="img" aria-label="Sales revenue chart">
        {yTicks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line x1={padding.left} y1={yPosition(tick)} x2={width - padding.right} y2={yPosition(tick)} className="admin-sales-grid-line" />
            <text x={padding.left - 8} y={yPosition(tick) + 4} textAnchor="end" className="admin-sales-axis-label">£{Math.round(tick / 100)}</text>
          </g>
        ))}

        {series.map((line, lineIndex) => {
          const path = line.points
            .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${xPosition(point.date)} ${yPosition(point.revenuePence)}`)
            .join(' ');

          return (
            <g key={line.key}>
              <path d={path} fill="none" stroke={colors[lineIndex % colors.length]} strokeWidth="2" />
              {line.points.map((point) => (
                <circle key={`${line.key}-${point.date}`} cx={xPosition(point.date)} cy={yPosition(point.revenuePence)} r="2.25" fill={colors[lineIndex % colors.length]}>
                  <title>{`${new Date(`${point.date}T00:00:00`).toLocaleDateString('en-GB')} · ${line.name}: ${formatPrice(point.revenuePence)}`}</title>
                </circle>
              ))}
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
        {series.map((line, index) => (
          <span key={`legend-${line.key}`} className="admin-sales-legend-item">
            <i style={{ background: colors[index % colors.length] }} />{line.name}
          </span>
        ))}
      </div>
    </div>
  );
}


export default function ShopAdminPanel() {
  const [activeTab, setActiveTab] = useState<ShopTab>('products');
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

  const [salesPreset, setSalesPreset] = useState<SalesRangePreset>('30');
  const [salesFrom, setSalesFrom] = useState(() => getRangeDates('30').from);
  const [salesTo, setSalesTo] = useState(() => getCurrentYmdInLondon());
  const [includeOverall, setIncludeOverall] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );
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
        points: productSeries.points.map((point) => ({ date: point.date, revenuePence: point.revenuePence }))
      });
    }

    return lines;
  }, [includeOverall, salesData]);


  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/shop/products');
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
    try {
      const response = await fetch('/api/admin/shop/orders');
      const payload = await response.json();
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
      const response = await fetch(`/api/admin/shop/orders/${orderId}`);
      const payload = await response.json();
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

    if (!includeOverall) {
      query.set('includeOverall', 'false');
    }

    if (selectedProductIds.length > 0) {
      query.set('productIds', selectedProductIds.join(','));
    }

    try {
      const response = await fetch(`/api/admin/shop/sales?${query.toString()}`);
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
      const response = await fetch('/api/admin/shop/sales', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not generate demo sales data.');
      setSuccess('Demo sales data generated.');
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
  }, [activeTab, salesPreset, salesFrom, salesTo, includeOverall, selectedProductIds.join(',')]);


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
    setFormOpen(false);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function startEdit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      description: product.description || '',
      priceGbp: (product.pricePence / 100).toFixed(2),
      imageUrl: product.imageUrl || '',
      active: product.active,
      featured: product.featured,
      sortOrder: product.sortOrder
    });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: trimmedName,
          description: form.description.trim(),
          pricePence,
          imageUrl: form.imageUrl.trim(),
          active: form.active,
          featured: form.featured,
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

  async function toggleField(productId: string, field: 'active' | 'featured', value: boolean) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/shop/products/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, field, value })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to update product.');
      await fetchProducts();
      setSuccess('Product updated.');
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update product.');
    }
  }

  async function disableProduct(productId: string) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/shop/products/delete', {
        method: 'POST',
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
  async function markCollected(orderId: string) {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}/collect`, { method: 'POST' });
      const payload = await response.json();
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

      <div className="admin-view-tabs admin-view-tabs--three" role="tablist" aria-label="Shop sections">
        <button type="button" className={`admin-filter-tab ${activeTab === 'products' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveTab('products')}>Products</button>
        <button type="button" className={`admin-filter-tab ${activeTab === 'orders' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveTab('orders')}>Orders</button>
        <button type="button" className={`admin-filter-tab ${activeTab === 'sales' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveTab('sales')}>Sales</button>
      </div>

      {activeTab === 'products' && (
        <div className="admin-reports admin-products-panel">
          <div className="admin-products-actions">
            <button type="button" className="btn btn--primary" onClick={startCreate}>Add product</button>
            <button type="button" className="btn btn--ghost" onClick={() => void fetchProducts()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          </div>

          {error ? <p className="admin-inline-error">{error}</p> : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}

          {formOpen ? (
            <form className="admin-product-form" onSubmit={saveProduct}>
              <h3>{form.id ? 'Edit product' : 'Add product'}</h3>
              <label>Name<input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
              <label>Description<textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} /></label>
              <label>Price (GBP)<input type="number" min="0.01" step="0.01" value={form.priceGbp} onChange={(event) => setForm((prev) => ({ ...prev, priceGbp: event.target.value }))} required /></label>
              <label>Image URL<input type="url" value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://..." /></label>
              <label>Sort order<input type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))} /></label>
              <label className="admin-product-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />Active</label>
              <label className="admin-product-checkbox"><input type="checkbox" checked={form.featured} onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))} />Featured</label>


              <div className="admin-products-actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
                <button type="button" className="btn btn--secondary" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          ) : null}

          <div className="admin-products-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Price</th><th>Active</th><th>Featured</th><th>Sort</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                {sortedProducts.length === 0 ? (<tr><td colSpan={7}>No products yet.</td></tr>) : sortedProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{formatPrice(product.pricePence)}</td>
                    <td>{product.active ? 'Yes' : 'No'}</td>
                    <td>{product.featured ? 'Yes' : 'No'}</td>
                    <td>{product.sortOrder}</td>
                    <td>{new Date(product.updatedAt).toLocaleString('en-GB')}</td>
                    <td>
                      <div className="admin-products-row-actions">
                        <button type="button" className="btn btn--ghost" onClick={() => startEdit(product)}>Edit</button>
                        <button type="button" className="btn btn--ghost" onClick={() => void toggleField(product.id, 'active', !product.active)}>{product.active ? 'Deactivate' : 'Activate'}</button>
                        <button type="button" className="btn btn--ghost" onClick={() => void toggleField(product.id, 'featured', !product.featured)}>{product.featured ? 'Unfeature' : 'Feature'}</button>
                        <button type="button" className="btn btn--secondary" onClick={() => void disableProduct(product.id)}>Delete</button>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="admin-reports admin-orders-panel">
          {error ? <p className="admin-inline-error">{error}</p> : null}
          {success ? <p className="admin-inline-success">{success}</p> : null}
          <div className="admin-products-actions">
            <button type="button" className="btn btn--ghost" onClick={() => void fetchOrders()} disabled={ordersLoading}>{ordersLoading ? 'Refreshing…' : 'Refresh orders'}</button>
          </div>
          <div className="admin-products-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Customer email</th><th>Total</th><th>Status</th><th>Items</th><th>Action</th></tr></thead>
              <tbody>
                {orders.length === 0 ? (<tr><td colSpan={6}>No orders yet.</td></tr>) : orders.map((order) => (
                  <tr key={order.id}>
                    <td>{new Date(order.createdAt).toLocaleString('en-GB')}</td>
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
              <button type="button" className="btn btn--primary" onClick={() => void fetchSales()} disabled={salesLoading}>{salesLoading ? 'Loading…' : 'Refresh sales'}</button>
              {import.meta.env.DEV ? (
                <button type="button" className="btn btn--secondary" onClick={() => void generateDemoSales()} disabled={generatingDemo}>{generatingDemo ? 'Generating…' : 'Generate demo sales data'}</button>
              ) : null}
            </div>
          </div>

          {(salesData?.kpis.ordersCount ?? 0) === 0 ? (
            <div className="admin-sales-empty">
              <p>No sales yet.</p>
            </div>
          ) : (
            <>
              <div className="admin-sales-chart-wrap">
                <MiniLineChart series={chartSeries} />
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
