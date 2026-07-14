import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SettingsGearIcon } from './SettingsGearIcon';
import AdminSectionHeader from './AdminSectionHeader';
import AdminDesktopDashHeroSlot from './AdminDesktopDashHeroSlot';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';
import EmptyState from '../EmptyState';
import { SkeletonBookingChoices } from '../skeleton';
import { ChevronDown, ChevronUp, Scissors, Search, Users, X } from '../lucide-react';
import { adminFetchJson, isPublicAdminDemoMode, notifyAdminDemoBlocked } from './adminAuth';
import ServiceCategoryPicker from './ServiceCategoryPicker';

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
  createdAt?: string;
  updatedAt?: string;
  barberServices?: Array<{
    barber: ServiceBarberRow;
  }>;
};

type ServiceFilter = 'all' | 'active' | 'inactive' | 'featured';
type ServiceSortMode = 'manual' | 'newest' | 'price' | 'name';

const SERVICE_SORT_OPTIONS: Array<{ value: ServiceSortMode; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'newest', label: 'Newest' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' }
];

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

function isFeaturedCategory(category: string | null | undefined): boolean {
  return category?.trim().toLowerCase() === 'featured';
}

function formatCategoryLabel(category: string | null | undefined): string {
  if (!category?.trim()) return 'Uncategorised';
  return category;
}

type ServiceStatusPillProps = {
  on: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
};

function ServiceStatusPill({ on, disabled, ariaLabel, onClick }: ServiceStatusPillProps) {
  return (
    <button
      type="button"
      className={[
        'admin-product-row__status-pill',
        'admin-product-row__status-pill--active',
        on ? 'is-on' : ''
      ].filter(Boolean).join(' ')}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="admin-product-row__status-dot" aria-hidden="true" />
      <span>{on ? 'Active' : 'Inactive'}</span>
    </button>
  );
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

function useAdminBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isLocked]);
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
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [barbers, setBarbers] = useState<BarberListRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [selectedBarberIds, setSelectedBarberIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [serviceSortMode, setServiceSortMode] = useState<ServiceSortMode>('manual');
  const [serviceSortOpen, setServiceSortOpen] = useState(false);
  const [manualOrderIds, setManualOrderIds] = useState<string[]>([]);
  const [serviceSavingById, setServiceSavingById] = useState<Record<string, boolean>>({});
  const [serviceStatusById, setServiceStatusById] = useState<Record<string, string>>({});
  const serviceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const serviceSortRef = useRef<HTMLDivElement | null>(null);
  const isMobileAdminChrome = useAdminMobileChromeBreakpoint();
  useAdminBodyScrollLock(isMobileAdminChrome && isServiceSheetOpen);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
    [services]
  );

  const manualServices = useMemo(() => {
    const validIds = manualOrderIds.filter((id) => serviceMap.has(id));
    const missingIds = sortedServices.map((service) => service.id).filter((id) => !validIds.includes(id));
    return [...validIds, ...missingIds]
      .map((id) => serviceMap.get(id))
      .filter((service): service is ServiceRow => Boolean(service));
  }, [manualOrderIds, serviceMap, sortedServices]);

  const baseServices = useMemo(() => {
    if (serviceSortMode === 'manual') return manualServices;
    const source = [...sortedServices];
    if (serviceSortMode === 'newest') {
      return source.sort(
        (a, b) =>
          Date.parse(b.updatedAt ?? b.createdAt ?? '') - Date.parse(a.updatedAt ?? a.createdAt ?? '') ||
          b.displayOrder - a.displayOrder
      );
    }
    if (serviceSortMode === 'price') {
      return source.sort((a, b) => b.pricePence - a.pricePence || a.name.localeCompare(b.name));
    }
    return source.sort((a, b) => a.name.localeCompare(b.name));
  }, [manualServices, serviceSortMode, sortedServices]);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    return baseServices.filter((service) => {
      if (serviceFilter === 'active' && !service.isActive) return false;
      if (serviceFilter === 'inactive' && service.isActive) return false;
      if (serviceFilter === 'featured' && !isFeaturedCategory(service.category)) return false;
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        (service.description || '').toLowerCase().includes(query) ||
        (service.category || '').toLowerCase().includes(query)
      );
    });
  }, [baseServices, serviceFilter, serviceSearch]);

  const featuredCount = useMemo(
    () => services.filter((service) => isFeaturedCategory(service.category)).length,
    [services]
  );
  const canReorder = serviceSortMode === 'manual' && serviceFilter === 'all' && serviceSearch.trim().length === 0;
  const servicesInitiallyLoading = loading && services.length === 0;

  const handleServiceSearchClear = useCallback(() => {
    setServiceSearch('');
    serviceSearchInputRef.current?.focus();
  }, []);
  const resetServiceFormState = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedBarberIds([]);
    setIsSaving(false);
    setIsServiceSheetOpen(false);
  }, []);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [servicesData, barbersData] = await Promise.all([
        adminFetchJson<{ services?: ServiceRow[]; categories?: string[] }>('/api/admin/services', {
          errorMessage: 'Unable to load services.',
        }),
        adminFetchJson<{ barbers?: BarberListRow[] }>('/api/admin/barbers', {
          errorMessage: 'Unable to load barbers.',
        })
      ]);

      setServices(servicesData.services ?? []);
      setAvailableCategories(servicesData.categories ?? []);
      setBarbers(barbersData.barbers ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load services.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddCategory = useCallback(async (name: string) => {
    const data = await adminFetchJson<{ categories?: string[] }>('/api/admin/service-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      errorMessage: 'Could not add category.',
    });
    setAvailableCategories(data.categories ?? []);
  }, []);


  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    setManualOrderIds(sortedServices.map((service) => service.id));
  }, [sortedServices]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      event.preventDefault();
      serviceSearchInputRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!serviceSortOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (serviceSortRef.current?.contains(event.target as Node)) return;
      setServiceSortOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setServiceSortOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [serviceSortOpen]);

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

  function openCreateServiceSheet() {
    if (isPublicAdminDemoMode()) {
      notifyAdminDemoBlocked();
      return;
    }
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

    if (!form.category.trim()) {
      setError('Category is required.');
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
      category: form.category.trim(),
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
      const data = await adminFetchJson<{ service?: ServiceRow; categories?: string[] }>(endpoint, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        errorMessage: 'Unable to save service.',
      });

      if (data.categories) {
        setAvailableCategories(data.categories);
      }

      setMessage(editingId ? 'Service updated.' : 'Service created.');
      resetServiceFormState();
      await fetchServices();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save service.');
    } finally {
      setIsSaving(false);
    }

  }

  async function toggleActive(service: ServiceRow) {
    const previousServices = services;
    setServiceSavingById((previous) => ({ ...previous, [service.id]: true }));
    setServiceStatusById((previous) => ({ ...previous, [service.id]: 'Saving…' }));
    setServices((previous) =>
      previous.map((entry) => (entry.id === service.id ? { ...entry, isActive: !entry.isActive } : entry))
    );

    try {
      const payload = await adminFetchJson<{ service?: ServiceRow }>(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !service.isActive }),
        errorMessage: 'Unable to update service status.',
      });
      if (payload.service) {
        setServices((previous) =>
          previous.map((entry) => (entry.id === service.id ? { ...entry, ...payload.service } : entry))
        );
      }
      setServiceStatusById((previous) => ({ ...previous, [service.id]: 'Saved' }));
      window.setTimeout(() => {
        setServiceStatusById((previous) => {
          const next = { ...previous };
          delete next[service.id];
          return next;
        });
      }, 900);
      setMessage(service.isActive ? 'Service deactivated.' : 'Service activated.');
      setError('');
    } catch (toggleError) {
      setServices(previousServices);
      setServiceStatusById((previous) => ({ ...previous, [service.id]: '' }));
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update service status.');
    } finally {
      setServiceSavingById((previous) => ({ ...previous, [service.id]: false }));
    }
  }

  async function saveManualOrder(orderedIds: string[]) {
    if (!canReorder) return;
    if (orderedIds.length === 0) return;

    const previous = manualOrderIds;
    setManualOrderIds(orderedIds);
    setServices((previousServices) => {
      const orderLookup = new Map(orderedIds.map((id, index) => [id, index]));
      return [...previousServices].sort(
        (a, b) => (orderLookup.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderLookup.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });

    try {
      const payload = await adminFetchJson<{ services?: ServiceRow[] }>('/api/admin/services/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
        errorMessage: 'Unable to save order.',
      });
      if (Array.isArray(payload.services)) {
        setServices(payload.services);
      }
      setMessage('Order updated.');
      setError('');
    } catch (reorderError) {
      setManualOrderIds(previous);
      await fetchServices();
      setError(reorderError instanceof Error ? reorderError.message : 'Unable to save order.');
    }
  }

  function moveItemUp(index: number) {
    if (!canReorder || index <= 0) return;
    const orderedIds = manualServices.map((service) => service.id);
    const nextOrderedIds = [...orderedIds];
    const [movedId] = nextOrderedIds.splice(index, 1);
    nextOrderedIds.splice(index - 1, 0, movedId);
    void saveManualOrder(nextOrderedIds);
  }

  function moveItemDown(index: number) {
    if (!canReorder || index < 0 || index >= manualServices.length - 1) return;
    const orderedIds = manualServices.map((service) => service.id);
    const nextOrderedIds = [...orderedIds];
    const [movedId] = nextOrderedIds.splice(index, 1);
    nextOrderedIds.splice(index + 1, 0, movedId);
    void saveManualOrder(nextOrderedIds);
  }

  const nameHasError = error === 'Service name is required.';
  const categoryHasError = error === 'Category is required.';
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

      <AdminDesktopDashHeroSlot />

      {message ? <p className="admin-inline-success">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      {!loading && services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No services yet"
          description="Add your first service to start accepting bookings."
        />
      ) : null}

      {services.length > 0 || loading ? (
        <div className="admin-reports admin-services-panel">
          <div className="admin-products-toolbar-sticky">
            <div className="admin-products-toolbar">
              <div className="admin-search-bar admin-products-toolbar-search" role="search">
                <Search className="admin-search-bar__icon" width={16} height={16} aria-hidden="true" />
                <input
                  ref={serviceSearchInputRef}
                  type="search"
                  className="admin-search-bar__input"
                  placeholder="Search services…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && handleServiceSearchClear()}
                  aria-label="Search services"
                  autoComplete="off"
                  spellCheck={false}
                />
                {serviceSearch ? (
                  <button
                    type="button"
                    className="admin-search-bar__clear"
                    onClick={handleServiceSearchClear}
                    aria-label="Clear search"
                  >
                    <X width={14} height={14} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className="admin-search-bar__kbd">/</kbd>
                )}
              </div>

              <div className="admin-products-toolbar-controls">
                <div className="admin-filter-scroll-wrap">
                  <div className="admin-products-filters" role="group" aria-label="Service filters">
                    {(['all', 'active', 'inactive', 'featured'] as ServiceFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={`admin-products-filter-tab${serviceFilter === filter ? ' admin-products-filter-tab--active' : ''}`}
                        onClick={() => setServiceFilter(filter)}
                        aria-pressed={serviceFilter === filter}
                      >
                        {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'inactive' ? 'Inactive' : 'Featured'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="admin-products-toolbar-right">
                  <div
                    ref={serviceSortRef}
                    className={`admin-products-sort-wrap${serviceSortOpen ? ' admin-products-sort-wrap--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-products-sort-trigger"
                      aria-label="Sort services"
                      aria-haspopup="listbox"
                      aria-expanded={serviceSortOpen}
                      onClick={() => setServiceSortOpen((open) => !open)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                          event.preventDefault();
                          setServiceSortOpen(true);
                        }
                      }}
                    >
                      <span>{SERVICE_SORT_OPTIONS.find((option) => option.value === serviceSortMode)?.label}</span>
                      <ChevronDown className="admin-products-sort-chevron" width={12} height={12} aria-hidden="true" />
                    </button>

                    {serviceSortOpen ? (
                      <div className="admin-products-sort-menu" role="listbox" aria-label="Sort services">
                        {SERVICE_SORT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`admin-products-sort-option${serviceSortMode === option.value ? ' admin-products-sort-option--active' : ''}`}
                            role="option"
                            aria-selected={serviceSortMode === option.value}
                            onClick={() => {
                              setServiceSortMode(option.value);
                              setServiceSortOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="admin-products-meta">
                    <span className="admin-products-count">
                      {filteredServices.length} services · {featuredCount} featured
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-products-scroll" role="region" aria-label="Services list">
            <div className="admin-product-list">
              {servicesInitiallyLoading ? (
                <div aria-label="Loading services" aria-busy="true">
                  <SkeletonBookingChoices count={4} variant="service" />
                </div>
              ) : filteredServices.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No services match"
                  description="Try adjusting your search or filter to find what you're looking for."
                  variant="filtered"
                />
              ) : (
                filteredServices.map((service, index) => {
                  const isSavingRow = Boolean(serviceSavingById[service.id]);
                  const manualIndex = manualServices.findIndex((entry) => entry.id === service.id);
                  const isFirstItem = manualIndex <= 0;
                  const isLastItem = manualIndex < 0 || manualIndex >= manualServices.length - 1;
                  const reorderDisabled = serviceSortMode !== 'manual' || !canReorder;
                  const categoryLabel = formatCategoryLabel(service.category);
                  const updatedLabel = service.updatedAt || service.createdAt
                    ? new Date(service.updatedAt ?? service.createdAt ?? '').toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : '—';
                  const serviceStatusLine = isSavingRow ? 'Saving…' : (serviceStatusById[service.id] || '');

                  return (
                    <article
                      key={service.id}
                      className={[
                        'admin-product-row',
                        'admin-product-row--service',
                        service.isActive ? '' : 'admin-product-row--inactive'
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="admin-product-row__thumb">
                        <Scissors className="admin-product-row__thumb-icon" aria-hidden="true" />
                      </div>

                      <div className="admin-product-row__identity">
                        <p className="admin-product-row__name">{service.name}</p>
                        <p className="admin-product-row__meta">
                          <span>{categoryLabel}</span>
                          <span className="admin-product-row__meta-sep" aria-hidden="true"> · </span>
                          <span title={`Updated ${updatedLabel}`}>{updatedLabel}</span>
                        </p>
                      </div>

                      <div className="admin-service-row__duration-col">
                        <span className="admin-service-row__duration">{service.durationMinutes} min</span>
                      </div>
                      <div className="admin-service-row__description-col">
                        {service.description ? (
                          <span className="admin-service-row__description" title={service.description}>
                            {service.description}
                          </span>
                        ) : (
                          <span className="admin-service-row__description admin-service-row__description--empty" aria-hidden="true">—</span>
                        )}
                      </div>

                      <div className="admin-product-row__price-status">
                        <p className="admin-product-row__price">{formatPrice(service.pricePence)}</p>
                        <ServiceStatusPill
                          on={service.isActive}
                          disabled={isSavingRow}
                          ariaLabel={`${service.name}: ${service.isActive ? 'Active' : 'Inactive'}`}
                          onClick={() => void toggleActive(service)}
                        />
                      </div>

                      <div className="admin-product-row__controls">
                        <button
                          type="button"
                          className="admin-product-row__edit-btn"
                          aria-label={`Edit ${service.name}`}
                          onClick={() => startEdit(service)}
                        >
                          <SettingsGearIcon className="admin-control-icon" aria-hidden="true" />
                        </button>

                        <div className="admin-reorder-controls admin-reorder-controls--product" role="group" aria-label={`Reorder ${service.name}`}>
                          <div className="admin-reorder-arrow-stack admin-reorder-arrow-stack--product">
                            <button
                              type="button"
                              className="admin-reorder-btn admin-reorder-btn--product"
                              aria-label={`Move ${service.name} up`}
                              disabled={reorderDisabled || isFirstItem}
                              onClick={() => moveItemUp(manualIndex >= 0 ? manualIndex : index)}
                            >
                              <ChevronUp width={14} height={14} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="admin-reorder-btn admin-reorder-btn--product"
                              aria-label={`Move ${service.name} down`}
                              disabled={reorderDisabled || isLastItem}
                              onClick={() => moveItemDown(manualIndex >= 0 ? manualIndex : index)}
                            >
                              <ChevronDown width={14} height={14} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {serviceStatusLine ? (
                        <p className="admin-product-row__saving-line" aria-live="polite">{serviceStatusLine}</p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isServiceSheetOpen ? (
        <div
          className="admin-barber-sheet-layer admin-service-sheet-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-service-form-title"
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
                  <h3 id="admin-service-form-title">{editingId ? 'EDIT SERVICE' : 'ADD SERVICE'}</h3>
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

                <div className={`field admin-service-field-stack${categoryHasError ? ' field--error' : ''}`}>
                  <span className="field__label">Category</span>
                  <span className="field__hint">Required — pick a category or add your own</span>
                  <ServiceCategoryPicker
                    value={form.category}
                    onChange={(category) => setForm((current) => ({ ...current, category }))}
                    categories={availableCategories}
                    onAddCategory={handleAddCategory}
                    hasError={categoryHasError}
                    disabled={isSaving}
                  />
                  {categoryHasError ? <span className="field__hint field__hint--error">{error}</span> : null}
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