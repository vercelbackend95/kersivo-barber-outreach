import React, { useEffect, useMemo, useState } from 'react';

type ShopTab = 'products' | 'orders';

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


  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.sortOrder - b.sortOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [products]
  );

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


  useEffect(() => {
    void fetchProducts();
  }, []);
  useEffect(() => {
    if (activeTab === 'orders') {
      void fetchOrders();
    }
  }, [activeTab]);

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


  return (
    <section className="booking-shell" aria-live="polite">
      <h2>Shop</h2>

      <div className="admin-view-tabs" role="tablist" aria-label="Shop sections">
        <button type="button" className={`admin-filter-tab ${activeTab === 'products' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveTab('products')}>Products</button>
        <button type="button" className={`admin-filter-tab ${activeTab === 'orders' ? 'admin-filter-tab--active' : ''}`} onClick={() => setActiveTab('orders')}>Orders</button>

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


    </section>
  );
}
