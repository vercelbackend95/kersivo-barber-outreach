import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SettingsGearIcon } from './SettingsGearIcon';
import AdminSectionHeader from './AdminSectionHeader';
import AdminDesktopDashHeroSlot from './AdminDesktopDashHeroSlot';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';
import EmptyState from '../EmptyState';
import { SkeletonBookingChoices } from '../skeleton';
import { ChevronDown, ChevronUp, Plus, Scissors, Search, Star, X } from '../lucide-react';
import { adminFetchJson, isPublicAdminDemoMode, notifyAdminDemoBlocked } from './adminAuth';
import ServiceWizard from './service-wizard/ServiceWizard';

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

type ServiceRow = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  pricePence: number;
  durationMinutes: number;
  bufferMinutes: number;
  displayOrder: number;
  category?: string | null;
  featured?: boolean;
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

function formatPrice(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function categoriesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left?.trim().toLowerCase() ?? '') === (right?.trim().toLowerCase() ?? '');
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

export default function ServicesAdminPanel() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [barbers, setBarbers] = useState<BarberListRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
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
      if (serviceFilter === 'featured' && !(service.featured ?? false)) return false;
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        (service.description || '').toLowerCase().includes(query) ||
        (service.category || '').toLowerCase().includes(query)
      );
    });
  }, [baseServices, serviceFilter, serviceSearch]);

  const featuredCount = useMemo(
    () => services.filter((service) => service.featured ?? false).length,
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
    setError('');
    setMessage('');
    setIsServiceSheetOpen(true);
  }

  function startEdit(service: ServiceRow) {
    setEditingId(service.id);
    setMessage('');
    setError('');
    setIsServiceSheetOpen(true);
  }

  async function toggleFeatured(service: ServiceRow) {
    const currentFeatured = service.featured ?? false;
    const nextFeatured = !currentFeatured;
    const previousServices = services;
    setServiceSavingById((previous) => ({ ...previous, [service.id]: true }));
    setServiceStatusById((previous) => ({ ...previous, [service.id]: 'Saving…' }));
    setServices((previous) =>
      previous.map((entry) => {
        if (entry.id === service.id) return { ...entry, featured: nextFeatured };
        if (nextFeatured && categoriesMatch(entry.category, service.category)) {
          return { ...entry, featured: false };
        }
        return entry;
      })
    );

    try {
      const payload = await adminFetchJson<{ service?: ServiceRow }>(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ featured: nextFeatured }),
        errorMessage: 'Unable to update featured status.',
      });
      if (payload.service) {
        setServices((previous) =>
          previous.map((entry) => {
            if (entry.id === service.id) return { ...entry, ...payload.service };
            if (nextFeatured && categoriesMatch(entry.category, service.category)) {
              return { ...entry, featured: false };
            }
            return entry;
          })
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
      setError('');
    } catch (toggleError) {
      setServices(previousServices);
      setServiceStatusById((previous) => ({ ...previous, [service.id]: '' }));
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update featured status.');
    } finally {
      setServiceSavingById((previous) => ({ ...previous, [service.id]: false }));
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

  const editingService = editingId ? services.find((s) => s.id === editingId) ?? null : null;

  return (
    <section className="surface booking-shell admin-services-shell">
      <AdminSectionHeader
        title="Services"
        description="Service catalogue"
        metaBadge={`${services.length} services`}
        actions={
          <button
            type="button"
            className="btn btn--primary btn--icon"
            aria-label="Add service"
            title="Add service"
            onClick={openCreateServiceSheet}
          >
            <Plus aria-hidden />
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
                        service.isActive ? '' : 'admin-product-row--inactive',
                        (service.featured ?? false) ? 'admin-product-row--featured' : ''
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="admin-product-row__thumb">
                        {service.imageUrl ? (
                          <img src={service.imageUrl} alt="" loading="lazy" draggable={false} />
                        ) : (
                          <Scissors className="admin-product-row__thumb-icon" aria-hidden="true" />
                        )}
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

                      <div className="admin-product-row__featured-col">
                        <button
                          type="button"
                          className={`admin-product-row__featured-btn${(service.featured ?? false) ? ' is-on' : ''}`}
                          role="switch"
                          aria-checked={service.featured ?? false}
                          aria-label={`${service.name}: ${(service.featured ?? false) ? 'Featured' : 'Not featured'}`}
                          disabled={isSavingRow}
                          onClick={() => void toggleFeatured(service)}
                          title={(service.featured ?? false) ? 'Featured' : 'Not featured'}
                        >
                          <Star
                            width={14}
                            height={14}
                            strokeWidth={(service.featured ?? false) ? 0 : 2}
                            style={(service.featured ?? false) ? { fill: 'currentColor' } : undefined}
                            aria-hidden="true"
                          />
                        </button>
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
          <ServiceWizard
            key={editingId ?? 'create'}
            mode={editingId ? 'edit' : 'create'}
            serviceId={editingId ?? undefined}
            initialForm={
              editingService
                ? {
                    name: editingService.name,
                    description: editingService.description ?? '',
                    imageUrl: editingService.imageUrl ?? '',
                    category: editingService.category ?? '',
                    priceGbp: (editingService.pricePence / 100).toFixed(2),
                    durationMinutes: String(editingService.durationMinutes),
                    bufferMinutes: String(editingService.bufferMinutes),
                    displayOrder: String(editingService.displayOrder),
                    isActive: editingService.isActive,
                    featured: editingService.featured ?? false
                  }
                : undefined
            }
            initialBarberIds={(editingService?.barberServices ?? []).map((relation) => relation.barber.id)}
            categories={availableCategories}
            barbers={barbers}
            isLoadingBarbers={loading}
            onAddCategory={handleAddCategory}
            onCancel={resetServiceFormState}
            onSaved={async ({ categories }) => {
              if (categories) setAvailableCategories(categories);
              await fetchServices();
            }}
          />
        </div>
      ) : null}

    </section>
  );
}