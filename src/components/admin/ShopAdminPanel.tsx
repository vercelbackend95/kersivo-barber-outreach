import React, { useState } from 'react';

type ShopTab = 'products' | 'orders';

export default function ShopAdminPanel() {
  const [activeTab, setActiveTab] = useState<ShopTab>('products');

  return (
    <section className="booking-shell" aria-live="polite">
      <h2>Shop</h2>

      <div className="admin-view-tabs" role="tablist" aria-label="Shop sections">
        <button
          type="button"
          className={`admin-filter-tab ${activeTab === 'products' ? 'admin-filter-tab--active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button
          type="button"
          className={`admin-filter-tab ${activeTab === 'orders' ? 'admin-filter-tab--active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
      </div>

      <div className="admin-reports">
        {activeTab === 'products' && <p>Products: coming next</p>}
        {activeTab === 'orders' && <p>Orders: coming next</p>}
      </div>
    </section>
  );
}
