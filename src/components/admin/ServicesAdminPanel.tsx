import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsGearIcon } from './SettingsGearIcon';

type ServiceBarberRow = {
  id: string;
  name: string;
  active: boolean;
};

type BarberListRow = {
  id: string;
  name: string;
  active: boolean;
  isActive?: boolean;
  serviceIds?: string[];
};

type ServicePanelBarberRow = {
  id: string;
  name: string;
  isAssigned: boolean;
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
function getServiceMetaChunks(service: ServiceRow) {
  const chunks = [`${formatPrice(service.pricePence)}`, `${service.durationMinutes} min`];
  if (service.bufferMinutes > 0) chunks.push(`Buffer ${service.bufferMinutes} min`);
  chunks.push(`Order ${service.displayOrder}`);
  return chunks;
}

export default function ServicesAdminPanel() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
    const [barbers, setBarbers] = useState<BarberListRow[]>([]);
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

  const fetchServices = useCallback(async () => {
    setLoading(true);

    try {
      const [servicesRes, barbersRes] = await Promise.all([
        fetch('/api/admin/services', { credentials: 'include' }),
        fetch('/api/admin/barbers', { credentials: 'include' })
      ]);

      const servicesData = await servicesRes.json().catch(() => ({} as { services?: ServiceRow[] }));
      const barbersData = await barbersRes.json().catch(() => ({} as { barbers?: BarberListRow[] }));

      setServices(servicesData.services ?? []);
      setBarbers(barbersData.barbers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

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

  const barbersForActiveServicePanel = useMemo<ServicePanelBarberRow[]>(() => {
    if (!activeServiceForPanel) return [];

    const assignedBarberIds = new Set((activeServiceForPanel.barberServices ?? []).map((relation) => relation.barber.id));
    const sourceBarbers = barbers.length > 0
      ? barbers.map((barber) => ({ id: barber.id, name: barber.name }))
      : (activeServiceForPanel.barberServices ?? []).map((relation) => ({
          id: relation.barber.id,
          name: relation.barber.name
        }));

    return sourceBarbers
      .map((barber) => ({
        id: barber.id,
        name: barber.name,
        isAssigned: assignedBarberIds.has(barber.id)
      }))
      .sort((left, right) => {
        if (left.isAssigned !== right.isAssigned) {
          return left.isAssigned ? -1 : 1;
        }

        return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
      });
  }, [activeServiceForPanel, barbers]);


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
      <p className="muted admin-services-intro">Manage service catalog and pricing for all new bookings.</p>

      {message ? <p className="admin-inline-success">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      {loading ? <p className="muted">Loading services…</p> : null}
      {!loading && services.length === 0 ? <p className="muted">No services yet. Add your first service.</p> : null}

      <div className="admin-barber-list-wrap">
        <ul className="admin-barber-grid admin-services-grid" aria-label="Services list">
          {services.map((service) => {
            const assignedBarbers = (service.barberServices ?? []).map((relation) => relation.barber);
            const serviceMetaChunks = getServiceMetaChunks(service);
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
                    <p className="admin-barber-next-line admin-service-meta-row">
                      {serviceMetaChunks.map((chunk, index) => (
                        <React.Fragment key={`${service.id}-meta-${chunk}`}>
                          {index > 0 ? <span className="admin-service-meta-separator" aria-hidden="true">•</span> : null}
                          <span className="admin-service-meta-chip">{chunk}</span>
                        </React.Fragment>
                      ))}
                    </p>
                    {service.category ? <p className="admin-barber-today-line">Category: {service.category}</p> : null}
                    {service.description ? <p className="admin-barber-today-line">{service.description}</p> : null}
                  </div>
                </button>

                <div className="admin-barber-actions admin-service-card-actions">
                  <p className="admin-service-actions-meta" aria-live="polite">
                    <span className="admin-service-actions-meta-label">Assigned</span>
                    <span className="admin-service-actions-meta-value">{assignedBarbers.length}</span>
                  </p>
                  <button
                    type="button"
                    className="admin-reorder-btn admin-reorder-btn--settings"
                    onClick={() => setActiveServiceForPanelId(service.id)}
                    aria-label={`Open ${service.name} settings panel`}
                  >
                    <SettingsGearIcon className="admin-control-icon" />
                  </button>
                </div>
              </li>
            );
          })}

          <li className="admin-barber-card admin-barber-card--add admin-service-card--add">
            <button type="button" className="admin-barber-add-btn" onClick={openCreateServiceSheet}>
              <span className="admin-barber-add-cluster">
                <span className="admin-barber-add-icon" aria-hidden="true">
                  +
                </span>
                <span className="admin-barber-add-label">Add service</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      {activeServiceForPanel ? (
        <div
          className="admin-barber-sheet-layer admin-service-sheet-layer"
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
            <div className="admin-barber-sheet-head admin-service-panel-head admin-client-modal-head">
              <h2>{activeServiceForPanel.name} panel</h2>
              <button
                type="button"
                className="btn btn--ghost admin-client-modal-close admin-service-panel-close"
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
              <p className="admin-barber-next-line">{getServiceMetaChunks(activeServiceForPanel).join(' · ')}</p>
              {activeServiceForPanel.category ? <p className="admin-barber-today-line">Category: {activeServiceForPanel.category}</p> : null}

              <div className="admin-service-assigned-barbers">
                <h4>Barbers assigned to this service.</h4>
                {barbersForActiveServicePanel.length > 0 ? (
                  <ul>
                    {barbersForActiveServicePanel.map((barber) => (
                      <li key={barber.id} className={barber.isAssigned ? 'is-assigned' : 'is-unassigned'}>
                        <span>{barber.name}</span>
                        <span
                          className={`admin-status-dot ${barber.isAssigned ? 'is-active' : 'is-inactive'}`}
                          aria-hidden="true"
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No barbers available yet.</p>
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
          className="admin-barber-sheet-layer admin-service-sheet-layer"
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
            <div className="admin-barber-sheet-head admin-service-sheet-head">
              <div className="admin-service-sheet-head-copy">
                <p className="admin-service-sheet-kicker">Service editor</p>
                <h3>{editingId ? 'EDIT SERVICE' : 'ADD SERVICE'}</h3>
              </div>
              <button
                type="button"
                className="btn btn--ghost admin-service-sheet-close"
                onClick={() => setIsServiceSheetOpen(false)}
                aria-label="Close service form"
              >
                ✕
              </button>
            </div>

            <div className="admin-barber-sheet-content admin-service-sheet-content">
              <div className="admin-service-field-stack">
                <label htmlFor="service-name">Service name</label>
                <input
                  id="service-name"
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. Haircut"
                  required
                />
              </div>

              <div className="admin-service-field-stack">
                <label htmlFor="service-description">Description (optional)</label>
                <input
                  id="service-description"
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                />
              </div>

              <div className="admin-service-field-stack">
                <label htmlFor="service-category">Category (optional)</label>
                <input
                  id="service-category"
                  value={form.category}
                  onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                />
              </div>

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

              <div className="admin-service-active-row">
                <div className="admin-service-active-copy">
                  <p className="admin-service-active-title">Service visibility</p>
                  <p className="admin-service-active-hint">Show this service in bookings and admin lists.</p>
                </div>
                <label className="admin-service-switch-wrap" htmlFor="service-active">
                  <input
                    id="service-active"
                    type="checkbox"
                                        className="admin-service-switch-input"
                    checked={form.isActive}
                    onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))}
                  />
                  <span className="admin-service-switch-track" aria-hidden="true">
                    <span className="admin-service-switch-thumb" />
                  </span>
                  <span className="admin-service-switch-label">Active</span>
                </label>
              </div>
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