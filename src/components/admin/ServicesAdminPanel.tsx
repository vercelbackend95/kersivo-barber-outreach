import React, { useEffect, useMemo, useState } from 'react';

type ServiceRow = {
  id: string;
  name: string;
  description?: string | null;
  pricePence: number;
  durationMinutes: number;
  bufferMinutes: number;
  displayOrder: number;
  category?: string | null;
  isActive: boolean;
};

type ServiceForm = {
  name: string;
  description: string;
  category: string;
  priceGbp: string;
  durationMinutes: string;
  bufferMinutes: string;
  displayOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  category: '',
  priceGbp: '',
  durationMinutes: '30',
  bufferMinutes: '0',
  displayOrder: '0',
  isActive: true
};

function formatPrice(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function toPence(input: string): number {
  const n = Number(input.replace(',', '.'));
  if (!Number.isFinite(n)) return -1;
  return Math.round(n * 100);
}

export default function ServicesAdminPanel() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const editingService = useMemo(() => services.find((s) => s.id === editingId) ?? null, [editingId, services]);

  async function fetchServices() {
    setLoading(true);
    const res = await fetch('/api/admin/services', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    setServices(data.services ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchServices();
  }, []);

  function startEdit(service: ServiceRow) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description ?? '',
      category: service.category ?? '',
      priceGbp: (service.pricePence / 100).toFixed(2),
      durationMinutes: String(service.durationMinutes),
      bufferMinutes: String(service.bufferMinutes),
      displayOrder: String(service.displayOrder),
      isActive: service.isActive
    });
    setMessage('');
    setError('');
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!form.name.trim()) {
      setError('Service name is required.');
      return;
    }

    const pricePence = toPence(form.priceGbp);
    if (pricePence < 0) {
      setError('Price must be a valid amount.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      pricePence,
      durationMinutes: Number(form.durationMinutes),
      bufferMinutes: Number(form.bufferMinutes),
      displayOrder: Number(form.displayOrder),
      isActive: form.isActive
    };

    const endpoint = editingId ? `/api/admin/services/${editingId}` : '/api/admin/services';
    const method = editingId ? 'PATCH' : 'POST';

    const res = await fetch(endpoint, {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { error?: string }));
      setError(data.error ?? 'Unable to save service.');
      return;
    }

    setMessage(editingId ? 'Service updated.' : 'Service created.');
    setEditingId(null);
    setForm(EMPTY_FORM);
    await fetchServices();
  }

  async function toggleActive(service: ServiceRow) {
    const res = await fetch(`/api/admin/services/${service.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !service.isActive })
    });

    if (res.ok) {
      setMessage(service.isActive ? 'Service deactivated.' : 'Service activated.');
      setError('');
      await fetchServices();
      return;
    }

    setError('Unable to update service status.');
  }

  return (
    <section className="surface booking-shell">
      <h1>SERVICES</h1>
      <p className="muted">Manage service catalog and pricing for all new bookings.</p>

      <form onSubmit={submitForm} className="admin-service-form">
        <label>Service name</label>
        <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />

        <label>Description (optional)</label>
        <input value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />

        <label>Category (optional)</label>
        <input value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))} />

        <div className="admin-service-form-grid">
          <div>
            <label>Price (GBP)</label>
            <input value={form.priceGbp} onChange={(e) => setForm((c) => ({ ...c, priceGbp: e.target.value }))} required />
          </div>
          <div>
            <label>Duration (minutes)</label>
            <input type="number" min={5} value={form.durationMinutes} onChange={(e) => setForm((c) => ({ ...c, durationMinutes: e.target.value }))} required />
          </div>
          <div>
            <label>Buffer (minutes)</label>
            <input type="number" min={0} value={form.bufferMinutes} onChange={(e) => setForm((c) => ({ ...c, bufferMinutes: e.target.value }))} />
          </div>
          <div>
            <label>Display order</label>
            <input type="number" min={0} value={form.displayOrder} onChange={(e) => setForm((c) => ({ ...c, displayOrder: e.target.value }))} />
          </div>
        </div>

        <label className="admin-service-checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} />
          <span>Active</span>
        </label>

        <div className="admin-service-actions">
          <button type="submit" className="btn btn--primary">{editingId ? 'Update service' : 'Create service'}</button>
          {editingId ? (
            <button type="button" className="btn btn--secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {message ? <p>{message}</p> : null}
      {error ? <p className="admin-error-text">{error}</p> : null}

      {loading ? <p className="muted">Loading services…</p> : null}
      {!loading && services.length === 0 ? <p className="muted">No services yet. Create your first service.</p> : null}

      <div className="admin-services-list">
        {services.map((service) => (
          <article key={service.id} className="admin-service-card">
            <div>
              <p><strong>{service.name}</strong> {service.isActive ? '' : '(Inactive)'}</p>
              <p className="muted">{formatPrice(service.pricePence)} · {service.durationMinutes} min · Order {service.displayOrder}</p>
              {service.description ? <p className="muted">{service.description}</p> : null}
            </div>
            <div className="admin-service-card-actions">
              <button type="button" className="btn btn--secondary" onClick={() => startEdit(service)}>Edit</button>
              <button type="button" className="btn btn--ghost" onClick={() => void toggleActive(service)}>{service.isActive ? 'Deactivate' : 'Activate'}</button>
            </div>
          </article>
        ))}
      </div>

      {editingService ? <p className="muted">Editing: {editingService.name}</p> : null}
    </section>
  );
}
