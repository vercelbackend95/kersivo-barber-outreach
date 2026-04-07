import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsGearIcon } from './SettingsGearIcon';
import AdminSectionHeader from './AdminSectionHeader';
import AdminBookingsOpsDashHeroLive from './AdminBookingsOpsDashHeroLive';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';
import EmptyState from '../EmptyState';
import { SkeletonBookingChoices } from '../skeleton';
import { Scissors, Users, X } from '../lucide-react';

type ServiceBarberRow = {
  id: string;
  name: string;
  active: boolean;
};

type BarberListRow = {
  id: string;
  name: string;
  /** Canonical activity field — always present in /api/admin/barbers responses. */
  isActive: boolean;
  /** Raw DB field, also returned by the API. Prefer `isActive`. */
  active?: boolean;
  avatarUrl?: string | null;
  email?: string | null;
  serviceIds?: string[];
  todayIsOnShift?: boolean;
};

type ServicePanelBarberRow = {
  id: string;
  name: string;
  isActive: boolean;
  avatarUrl?: string | null;
  isAssigned: boolean;
};
type ServiceBarberAssignmentListRow = {
  id: string;
  name: string;
  isActive: boolean;
  avatarUrl?: string | null;
  isSelected: boolean;
  subline: string;
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
type BarberAssignmentSectionProps = {
  barbers: BarberListRow[];
  selectedBarberIds: string[];
  isLoading: boolean;
  onChange: (barberIds: string[]) => void;
};
type ServiceBarberAssignmentListProps = {
  rows: ServiceBarberAssignmentListRow[];
  ariaLabel: string;
  onToggle?: (barberId: string) => void;
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
  const core = [`${formatPrice(service.pricePence)}`, `${service.durationMinutes} min`];
  const secondary = [`Order ${service.displayOrder}`];
  if (service.bufferMinutes > 0) secondary.unshift(`Buffer ${service.bufferMinutes} min`);
  return { core, secondary };
}
function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'B';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}
function ServiceBarberAssignmentList({ rows, ariaLabel, onToggle }: ServiceBarberAssignmentListProps) {
  return (
    <div className="admin-service-assignment-list" role="list" aria-label={ariaLabel}>
      {rows.map((barber) => {
        const rowClassName = `admin-service-assignment-row${barber.isSelected ? ' is-selected' : ''}${onToggle ? '' : ' is-readonly'}`;
        const content = (
          <>
            <span className="admin-service-assignment-row-main">
              <span className="admin-barber-avatar admin-service-assignment-avatar" aria-hidden="true">
                {barber.avatarUrl ? <img src={barber.avatarUrl} alt="" loading="lazy" /> : <span>{getInitials(barber.name)}</span>}
              </span>
              <span className="admin-service-assignment-text">
                <span className="admin-service-assignment-name-row">
                  <span className="admin-service-assignment-name">{barber.name}</span>
                  <span className="admin-service-assignment-status" aria-label={barber.isActive ? 'Active barber' : 'Inactive barber'}>
                    <span className={`admin-status-dot ${barber.isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                  </span>
                </span>
                <span className="admin-service-assignment-subline">{barber.subline}</span>
              </span>
            </span>

            <span className={`admin-service-assignment-indicator ${barber.isSelected ? 'is-selected' : ''}`} aria-hidden="true">
              <span className="admin-service-assignment-indicator-mark">✓</span>
            </span>
          </>
        );

        if (!onToggle) {
          return (
            <div key={barber.id} className={rowClassName} role="listitem">
              {content}
            </div>
          );
        }

        return (
          <button
            key={barber.id}
            type="button"
            className={rowClassName}
            aria-pressed={barber.isSelected}
            onClick={() => onToggle(barber.id)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function BarberAssignmentSection({ barbers, selectedBarberIds, isLoading, onChange }: BarberAssignmentSectionProps) {
  const selectedBarberIdSet = useMemo(() => new Set(selectedBarberIds), [selectedBarberIds]);

  const sortedBarbers = useMemo(
    () =>
      [...barbers].sort((left, right) => {
        const leftIsActive = left.isActive;
        const rightIsActive = right.isActive;

        if (leftIsActive !== rightIsActive) {
          return leftIsActive ? -1 : 1;
        }

        return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
      }),
    [barbers]
  );

  const availableBarberIds = useMemo(() => sortedBarbers.map((barber) => barber.id), [sortedBarbers]);
  const activeSelectionCount = selectedBarberIds.filter((id) => availableBarberIds.includes(id)).length;

  function toggleBarber(barberId: string) {
    if (selectedBarberIdSet.has(barberId)) {
      onChange(selectedBarberIds.filter((id) => id !== barberId));
      return;
    }

    onChange([...selectedBarberIds, barberId]);
  }

  function selectAll() {
    onChange(availableBarberIds);
  }

  function clearSelection() {
    onChange([]);
  }

  return (
    <section className="admin-service-assignment-section" aria-labelledby="service-barber-assignment-title">
      <div className="admin-service-assignment-header">
        <div className="admin-service-assignment-copy">
          <p className="admin-service-assignment-eyebrow">BARBERS FOR THIS SERVICE</p>
          <h3 id="service-barber-assignment-title">Choose which barbers can offer this service.</h3>
        </div>

        <div className="admin-service-assignment-tools" aria-label="Barber selection tools">
          <span className="admin-service-assignment-count">{activeSelectionCount} selected</span>
          <button
            type="button"
            className="admin-service-assignment-tool"
            onClick={selectAll}
            disabled={availableBarberIds.length === 0 || activeSelectionCount === availableBarberIds.length}
          >
            Select all
          </button>
          <button
            type="button"
            className="admin-service-assignment-tool"
            onClick={clearSelection}
            disabled={activeSelectionCount === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="admin-service-assignment-skeleton" aria-hidden="true" aria-label="Loading barbers">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton--row skeleton" />
          ))}
        </div>
      ) : null}

      {!isLoading && sortedBarbers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No barbers available"
          description="Add barbers in the Barbers section first, then assign them to this service here."
        />
      ) : null}

      {!isLoading && sortedBarbers.length > 0 ? (
        <ServiceBarberAssignmentList
          rows={sortedBarbers.map((barber) => ({
            id: barber.id,
            name: barber.name,
            isActive: barber.isActive,
            avatarUrl: barber.avatarUrl,
            isSelected: selectedBarberIdSet.has(barber.id),
            subline: barber.isActive ? 'Available for bookings' : 'Hidden from live bookings'
          }))}
          ariaLabel="Available barbers for this service"
          onToggle={toggleBarber}
        />
      ) : null}
    </section>
  );
}


export default function ServicesAdminPanel() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [barbers, setBarbers] = useState<BarberListRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
    const [selectedBarberIds, setSelectedBarberIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [activeServiceForPanelId, setActiveServiceForPanelId] = useState<string | null>(null);
  const isMobileAdminChrome = useAdminMobileChromeBreakpoint();

  const activeServiceForPanel = useMemo(
    () => services.find((service) => service.id === activeServiceForPanelId) ?? null,
    [activeServiceForPanelId, services]
  );
  const resetServiceFormState = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedBarberIds([]);
    setIsSaving(false);
    setIsServiceSheetOpen(false);
  }, []);

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
        resetServiceFormState();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isServiceSheetOpen, resetServiceFormState]);

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
      ? barbers.map((barber) => ({
          id: barber.id,
          name: barber.name,
          isActive: barber.isActive,
          avatarUrl: barber.avatarUrl
        }))
      : (activeServiceForPanel.barberServices ?? []).map((relation) => ({
          id: relation.barber.id,
          name: relation.barber.name,
          isActive: relation.barber.active,
          avatarUrl: null
        }));

    return sourceBarbers
      .map((barber) => ({
        id: barber.id,
        name: barber.name,
        isActive: barber.isActive,
        avatarUrl: barber.avatarUrl,
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
        setSelectedBarberIds([]);
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
        setSelectedBarberIds((service.barberServices ?? []).map((relation) => relation.barber.id));
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
      isActive: form.isActive,
      barberIds: selectedBarberIds

    };

    const endpoint = editingId ? `/api/admin/services/${editingId}` : '/api/admin/services';
    const method = editingId ? 'PATCH' : 'POST';

    setIsSaving(true);

    try {
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
      resetServiceFormState();
      await fetchServices();
    } finally {
      setIsSaving(false);
    }

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

  const nameHasError = error === 'Service name is required.';
  const priceHasError = error === 'Price must be a valid amount.';

  const editingService = editingId ? services.find((s) => s.id === editingId) ?? null : null;

  return (
    <section className="surface booking-shell admin-services-shell">
      <AdminSectionHeader
        title="Services"
        description="Configure your service catalogue"
        metaBadge={`${services.length} services`}
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreateServiceSheet}>
            Add Service
          </button>
        }
      />

      {!isMobileAdminChrome ? <AdminBookingsOpsDashHeroLive /> : null}

      {message ? <p className="admin-inline-success">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      {loading ? (
        <div className="admin-services-list-wrap" aria-busy="true">
          <div className="admin-services-list admin-services-list--loading" aria-hidden="true">
            <SkeletonBookingChoices count={4} variant="service" />
          </div>
        </div>
      ) : null}
      {!loading && services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No services yet"
          description="Add your first service to start accepting bookings."
        />
      ) : null}

      {services.length > 0 ? (
        <div className="admin-services-list-wrap">
          <ul className="admin-services-list" aria-label="Services list">
            {services.map((service) => {
              const assignedBarbers = (service.barberServices ?? []).map((relation) => relation.barber);
              const serviceMeta = getServiceMeta(service);
              return (
                <li key={service.id} className={`admin-service-card ${service.isActive ? '' : 'is-inactive'}`}>
                  <div className="admin-service-card-header">
                    <div className="admin-service-card-title-wrap">
                      <p className="admin-service-card-name" title={service.name}>{service.name}</p>
                      <span className="admin-service-card-status" role="status" aria-label={service.isActive ? 'Active' : 'Inactive'}>
                        <span className="admin-service-card-status-label">{service.isActive ? 'Active' : 'Inactive'}</span>
                        <span className="admin-service-card-status-dot-wrap">
                          <span className={`admin-status-dot ${service.isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="admin-reorder-btn admin-reorder-btn--settings admin-service-settings-btn"
                      onClick={() => setActiveServiceForPanelId(service.id)}
                      aria-label={`Open ${service.name} settings panel`}
                    >
                      <SettingsGearIcon className="admin-control-icon" />
                    </button>
                  </div>

                  <div className="admin-service-card-body">
                    <div className="admin-service-meta-group admin-service-meta-group--core">
                      {serviceMeta.core.map((chunk) => (
                        <span key={`${service.id}-core-${chunk}`} className="admin-service-meta-chip admin-service-meta-chip--core">{chunk}</span>
                      ))}
                    </div>
                    <div className="admin-service-meta-group admin-service-meta-group--secondary">
                      {serviceMeta.secondary.map((chunk) => (
                        <span key={`${service.id}-secondary-${chunk}`} className="admin-service-meta-chip">{chunk}</span>
                      ))}
                    </div>
                    {service.category ? <p className="admin-service-support-line">Category: {service.category}</p> : null}
                    {service.description ? <p className="admin-service-support-line">{service.description}</p> : null}
                  </div>

                  <div className="admin-service-card-footer">
                    <p className="admin-service-actions-meta" aria-live="polite">
                      <span className="admin-service-actions-meta-label">Assigned</span>
                      <span className="admin-service-actions-meta-value">{assignedBarbers.length}</span>
                    </p>
                    <button type="button" className="btn btn--ghost admin-service-edit-btn" onClick={() => startEdit(service)}>
                      Edit
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
              <h3>{activeServiceForPanel.name} panel</h3>
              <button
                type="button"
                className="btn btn--ghost admin-client-modal-close admin-service-panel-close"
                onClick={() => setActiveServiceForPanelId(null)}
                aria-label="Close service settings"
              >
                <X width={18} height={18} aria-hidden="true" />
              </button>
            </div>

            <div className="admin-barber-sheet-content admin-service-sheet-content">
              <p className="admin-barber-status-line">
                <span className={`admin-status-dot ${activeServiceForPanel.isActive ? 'is-active' : 'is-inactive'}`} aria-hidden="true" />
                {activeServiceForPanel.isActive ? 'Active' : 'Inactive'}
              </p>
              <p className="admin-barber-next-line">
                {[...getServiceMeta(activeServiceForPanel).core, ...getServiceMeta(activeServiceForPanel).secondary].join(' · ')}
              </p>
              {activeServiceForPanel.category ? <p className="admin-barber-today-line">Category: {activeServiceForPanel.category}</p> : null}

              <section className="admin-service-assignment-section admin-service-assigned-barbers-section" aria-labelledby="service-panel-assigned-barbers-title">
                <div className="admin-service-assignment-header">
                  <div className="admin-service-assignment-copy">
                    <p className="admin-service-assignment-eyebrow">BARBERS FOR THIS SERVICE</p>
                    <h3 id="service-panel-assigned-barbers-title">Current barber assignment.</h3>
                  </div>
                  <div className="admin-service-assignment-tools" aria-label="Assigned barbers summary">
                    <span className="admin-service-assignment-count">
                      {barbersForActiveServicePanel.filter((barber) => barber.isAssigned).length} assigned
                    </span>
                  </div>
                </div>

                {barbersForActiveServicePanel.length > 0 ? (
                  <ServiceBarberAssignmentList
                    rows={barbersForActiveServicePanel.map((barber) => ({
                      id: barber.id,
                      name: barber.name,
                      isActive: barber.isActive,
                      avatarUrl: barber.avatarUrl,
                      isSelected: barber.isAssigned,
                      subline: barber.isAssigned ? 'Assigned to this service' : 'Not assigned to this service'
                    }))}
                    ariaLabel="Barbers assigned in this service panel"
                  />
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No barbers available"
                    description="Add barbers in the Barbers section first, then assign them to this service."
                  />
                )}
              </section>
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
              resetServiceFormState();
            }
          }}
        >
          <form className="admin-barber-sheet admin-service-sheet" onSubmit={submitForm} onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-barber-sheet-head admin-service-sheet-head admin-service-panel-head admin-client-modal-head">
              <div className="admin-sheet-head-copy">
                <div className="admin-sheet-head-title-row">
                  <h3>{editingId ? 'EDIT SERVICE' : 'ADD SERVICE'}</h3>
                  {editingService ? (
                    <span
                      className={`badge badge--sm ${editingService.isActive ? 'badge--confirmed' : 'badge--neutral'}`}
                      aria-label={editingService.isActive ? 'Active' : 'Inactive'}
                    >
                      {editingService.isActive ? 'Active' : 'Inactive'}
                    </span>
                  ) : null}
                </div>
                {editingService ? (
                  <p className="admin-sheet-entity-name" title={editingService.name}>{editingService.name}</p>
                ) : null}
              </div>

              <button
                type="button"
                className="btn btn--ghost admin-client-modal-close admin-service-panel-close"
                onClick={resetServiceFormState}
                aria-label="Close service form"
              >
                <X width={18} height={18} aria-hidden="true" />
              </button>
            </div>

            <div className="admin-barber-sheet-content admin-service-sheet-content">

              <fieldset className="admin-form-section">
                <legend className="admin-form-section-title">Basic Information</legend>

                <div className={`field admin-service-field-stack${nameHasError ? ' field--error' : ''}`}>
                  <label htmlFor="service-name" className="field__label">Service name</label>
                  <input
                    id="service-name"
                    className={`input${nameHasError ? ' input--error' : ''}`}
                    value={form.name}
                    onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. Haircut"
                    required
                    aria-invalid={nameHasError || undefined}
                  />
                  {nameHasError ? <span className="field__hint field__hint--error">{error}</span> : null}
                </div>

                <div className="field admin-service-field-stack">
                  <label htmlFor="service-description" className="field__label">Description</label>
                  <span className="field__hint">Optional — shown in the booking flow</span>
                  <input
                    id="service-description"
                    className="input"
                    value={form.description}
                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                    placeholder="e.g. Classic cut with scissors and clippers"
                  />
                </div>

                <div className="field admin-service-field-stack">
                  <label htmlFor="service-category" className="field__label">Category</label>
                  <span className="field__hint">Optional — groups services in the catalogue</span>
                  <input
                    id="service-category"
                    className="input"
                    value={form.category}
                    onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                    placeholder="e.g. Hair, Beard"
                  />
                </div>
              </fieldset>

              <fieldset className="admin-form-section">
                <legend className="admin-form-section-title">Pricing &amp; Timing</legend>

                <div className="admin-service-form-grid">
                  <div className={`field${priceHasError ? ' field--error' : ''}`}>
                    <label htmlFor="service-price" className="field__label">Price</label>
                    <span className="field__hint">In GBP</span>
                    <div className={`admin-price-input-wrap${priceHasError ? ' admin-price-input-wrap--error' : ''}`}>
                      <span>£</span>
                      <input
                        id="service-price"
                        inputMode="decimal"
                        value={form.priceGbp}
                        onChange={(e) => setForm((c) => ({ ...c, priceGbp: e.target.value }))}
                        placeholder="0.00"
                        required
                        aria-invalid={priceHasError || undefined}
                      />
                    </div>
                    {priceHasError ? <span className="field__hint field__hint--error">{error}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="service-duration" className="field__label">Duration</label>
                    <span className="field__hint">Minutes</span>
                    <input
                      id="service-duration"
                      className="input"
                      type="number"
                      min={5}
                      value={form.durationMinutes}
                      onChange={(e) => setForm((c) => ({ ...c, durationMinutes: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="service-buffer" className="field__label">Buffer</label>
                    <span className="field__hint">Minutes after service</span>
                    <input
                      id="service-buffer"
                      className="input"
                      type="number"
                      min={0}
                      value={form.bufferMinutes}
                      onChange={(e) => setForm((c) => ({ ...c, bufferMinutes: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="service-order" className="field__label">Display order</label>
                    <span className="field__hint">Lower = shown first</span>
                    <input
                      id="service-order"
                      className="input"
                      type="number"
                      min={0}
                      value={form.displayOrder}
                      onChange={(e) => setForm((c) => ({ ...c, displayOrder: e.target.value }))}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="admin-form-section">
                <legend className="admin-form-section-title">Visibility</legend>

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
              </fieldset>

              <BarberAssignmentSection
                barbers={barbers}
                selectedBarberIds={selectedBarberIds}
                isLoading={loading}
                onChange={setSelectedBarberIds}
              />

            </div>

            <div className="admin-barber-sheet-footer admin-service-sheet-foot">
              <button type="submit" className="btn btn--primary" disabled={isSaving}>
                {isSaving ? (editingId ? 'Updating…' : 'Creating…') : (editingId ? 'Update service' : 'Create service')}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={resetServiceFormState}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

    </section>
  );
}