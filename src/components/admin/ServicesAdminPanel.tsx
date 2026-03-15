import React, { useEffect, useMemo, useState } from 'react';
import { SettingsGearIcon } from './SettingsGearIcon';

type ServiceBarberRow = {
  id: string;
  name: string;
  active: boolean;
};

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
  barberServices?: Array<{
    barber: ServiceBarberRow;
  }>;
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

function getServiceMeta(service: ServiceRow) {
  const chunks = [`${formatPrice(service.pricePence)}`, `${service.durationMinutes} min`];
  if (service.bufferMinutes > 0) chunks.push(`Buffer ${service.bufferMinutes} min`);
  chunks.push(`Order ${service.displayOrder}`);
  return chunks.join(' · ');
}

export default function ServicesAdminPanel() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [activeServiceForPanelId, setActiveServiceForPanelId] = useState<string | null>(null);

  const editingService = useMemo(() => services.find((s) => s.id === editingId) ?? null, [editingId, services]);
  const activeServiceForPanel = useMemo(
    () => services.find((service) => service.id === activeServiceForPanelId) ?? null,
    [activeServiceForPanelId, services]
  );

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

  useEffect(() => {
    if (!isServiceSheetOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsServiceSheetOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isServiceSheetOpen]);

  useEffect(() => {
    if (!activeServiceForPanel) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveServiceForPanelId(null);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeServiceForPanel]);

  function openCreateServiceSheet() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setMessage('');
    setIsServiceSheetOpen(true);
  }

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
    setIsServiceSheetOpen(true);
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
    setIsServiceSheetOpen(false);
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
      setActiveServiceForPanelId(null);
      await fetchServices();
      return;
    }

    setError('Unable to update service status.');
  }

  return (
    <section className="surface booking-shell admin-services-shell">
      <h1>SERVICES</h1>
      <p className="muted">Manage service catalog and pricing for all new bookings.</p>

      {message ? <p className="admin-inline-success">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      {loading ? <p className="muted">Loading services…</p> : null}
      {!loading && services.length === 0 ? <p className="muted">No services yet. Add your first service.</p> : null}

      <div className="admin-barber-list-wrap">
        <ul className="admin-barber-grid admin-services-grid" aria-label="Services list">
          {services.map((service) => {
            const assignedBarbers = (service.barberServices ?? []).map((relation) => relation.barber);

            return (
              <li key={service.id} className={`admin-barber-card admin-service-list-card ${service.isActive ? '' : 'is-inactive'}`}>
                <button type="button" className="admin-barber-identity admin-service-identity" onClick={() => startEdit(service)}>
                  <div className="admin-service-copy">
                    <div className="admin-barber-name-row">
                      <p className="admin-barber-name">{service.name}</p>
                      <span className="admin-barber-status-indicator" role="status" aria-label={service.isActive ? 'Active' : 'Inactive'}>
                        <span className={`admin-status-dot ${service.isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                      </span>
                    </div>
                    <p className="admin-barber-next-line">{getServiceMeta(service)}</p>
                    {service.category ? <p className="admin-barber-today-line">Category: {service.category}</p> : null}
                    {service.description ? <p className="admin-barber-today-line">{service.description}</p> : null}
                  </div>
                </button>

                <div className="admin-barber-actions admin-service-card-actions">
                  <button
                    type="button"
                    className="admin-reorder-btn admin-reorder-btn--settings"
                    onClick={() => setActiveServiceForPanelId(service.id)}
                    aria-label={`Open ${service.name} settings panel`}
                  >
                    <SettingsGearIcon className="admin-control-icon" />
                  </button>
                  <p className="admin-service-actions-meta" aria-live="polite">
                    Barbers assigned: {assignedBarbers.length}
                  </p>
                </div>
              </li>
            );
          })}

          <li className="admin-barber-card admin-barber-card--add admin-service-card--add">
            <button type="button" className="admin-barber-add-btn" onClick={openCreateServiceSheet}>
              <span className="admin-barber-add-icon" aria-hidden="true">
                +
              </span>
              <span>Add service</span>
            </button>
          </li>
        </ul>
      </div>

      {activeServiceForPanel ? (
        <div
          className="admin-barber-sheet-layer"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeServiceForPanel.name} settings`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveServiceForPanelId(null);
            }
          }}
        >
          <section className="admin-barber-sheet admin-service-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-barber-sheet-head">
              <h3>{activeServiceForPanel.name} panel</h3>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setActiveServiceForPanelId(null)}
                aria-label="Close service settings"
              >
                ✕
              </button>
            </div>

            <div className="admin-barber-sheet-content admin-service-sheet-content">
              <p className="admin-barber-status-line">
                <span className={`admin-status-dot ${activeServiceForPanel.isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                {activeServiceForPanel.isActive ? 'Active' : 'Inactive'}
              </p>
              <p className="admin-barber-next-line">{getServiceMeta(activeServiceForPanel)}</p>
              {activeServiceForPanel.category ? <p className="admin-barber-today-line">Category: {activeServiceForPanel.category}</p> : null}

              <div className="admin-service-assigned-barbers">
                <h4>Barbers assigned to this service.</h4>
                {activeServiceForPanel.barberServices && activeServiceForPanel.barberServices.length > 0 ? (
                  <ul>
                    {activeServiceForPanel.barberServices.map((relation) => (
                      <li key={relation.barber.id}>
                        <span>{relation.barber.name}</span>
                        <span className={`admin-status-dot ${relation.barber.active ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No barbers assigned yet.</p>
                )}
              </div>
            </div>

            <div className="admin-barber-sheet-footer admin-service-sheet-foot">
              <button type="button" className="btn btn--primary" onClick={() => void toggleActive(activeServiceForPanel)}>
                {activeServiceForPanel.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setActiveServiceForPanelId(null);
                  startEdit(activeServiceForPanel);
                }}
              >
                Edit service
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isServiceSheetOpen ? (
        <div
          className="admin-barber-sheet-layer"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit service' : 'Add service'}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsServiceSheetOpen(false);
            }
          }}
        >
          <form className="admin-barber-sheet admin-service-sheet" onSubmit={submitForm} onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-barber-sheet-head">
              <h3>{editingId ? 'Edit service' : 'Add service'}</h3>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setIsServiceSheetOpen(false)}
                aria-label="Close service form"
              >
                ✕
              </button>
            </div>

            <div className="admin-barber-sheet-content admin-service-sheet-content">
              <label htmlFor="service-name">Service name</label>
              <input
                id="service-name"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="e.g. Haircut"
                required
              />

              <label htmlFor="service-description">Description (optional)</label>
              <input
                id="service-description"
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              />

              <label htmlFor="service-category">Category (optional)</label>
              <input
                id="service-category"
                value={form.category}
                onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
              />

              <div className="admin-service-form-grid">
                <div>
                  <label htmlFor="service-price">Price (GBP)</label>
                  <input
                    id="service-price"
                    value={form.priceGbp}
                    onChange={(e) => setForm((c) => ({ ...c, priceGbp: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="service-duration">Duration (minutes)</label>
                  <input
                    id="service-duration"
                    type="number"
                    min={5}
                    value={form.durationMinutes}
                    onChange={(e) => setForm((c) => ({ ...c, durationMinutes: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="service-buffer">Buffer (minutes)</label>
                  <input
                    id="service-buffer"
                    type="number"
                    min={0}
                    value={form.bufferMinutes}
                    onChange={(e) => setForm((c) => ({ ...c, bufferMinutes: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="service-order">Display order</label>
                  <input
                    id="service-order"
                    type="number"
                    min={0}
                    value={form.displayOrder}
                    onChange={(e) => setForm((c) => ({ ...c, displayOrder: e.target.value }))}
                  />
                </div>
              </div>

              <label className="admin-service-checkbox" htmlFor="service-active">
                <input
                  id="service-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))}
                />
                <span>Active</span>
              </label>
            </div>

            <div className="admin-barber-sheet-footer admin-service-sheet-foot">
              <button type="submit" className="btn btn--primary">
                {editingId ? 'Update service' : 'Create service'}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                  setIsServiceSheetOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingService ? <p className="muted">Editing: {editingService.name}</p> : null}
    </section>
  );
}