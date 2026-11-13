import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SettingsGearIcon } from './SettingsGearIcon';
import AdminSectionHeader from './AdminSectionHeader';
import AdminAddButton from './AdminAddButton';
import AdminMobileFab from './AdminMobileFab';
import AdminDesktopDashHeroSlot from './AdminDesktopDashHeroSlot';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';
import EmptyState from '../EmptyState';
import { SkeletonBookingChoices } from '../skeleton';
import { ChevronDown, Scissors, Search, Star } from '../lucide-react';
import { adminFetchJson, isPublicAdminDemoMode, notifyAdminDemoBlocked } from './adminAuth';
import { stripAdminAddQueryFromUrl } from '@/lib/admin/addQuery';
import ServiceWizard from './service-wizard/ServiceWizard';
import AdminWizardSheetLayer from './AdminWizardSheetLayer';
import AdminPremiumSearchBar from './AdminPremiumSearchBar';
import AdminDataTable, {
  AdminTableFilters,
  AdminTableIdentity,
  AdminTableSortSelect,
  AdminTableSwitchPill,
  AdminTableToolbar,
  type AdminDataTableColumn,
} from './AdminDataTable';

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
type ServiceSortMode = 'newest' | 'price' | 'name';

const SERVICE_SORT_OPTIONS: Array<{ value: ServiceSortMode; label: string }> = [
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
    <AdminTableSwitchPill
      on={on}
      onLabel="Active"
      offLabel="Inactive"
      ariaLabel={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="admin-product-row__status-pill"
    />
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

export default function ServicesAdminPanel({
  isBlacklineDemo = false,
  showcaseMode = false,
  openCreateOnMount = false,
}: {
  isBlacklineDemo?: boolean;
  showcaseMode?: boolean;
  openCreateOnMount?: boolean;
}) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [starterMinActiveServicePricePence, setStarterMinActiveServicePricePence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [barbers, setBarbers] = useState<BarberListRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [serviceSortMode, setServiceSortMode] = useState<ServiceSortMode>('name');
  const [serviceSortOpen, setServiceSortOpen] = useState(false);
  const [serviceSavingById, setServiceSavingById] = useState<Record<string, boolean>>({});
  const [serviceStatusById, setServiceStatusById] = useState<Record<string, string>>({});
  const serviceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const serviceSortRef = useRef<HTMLDivElement | null>(null);
  const addIntentConsumedRef = useRef(false);
  const isMobileAdminChrome = useAdminMobileChromeBreakpoint();
  useAdminBodyScrollLock(isMobileAdminChrome && isServiceSheetOpen);

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
    [services]
  );

  const baseServices = useMemo(() => {
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
  }, [serviceSortMode, sortedServices]);

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
  const showcasedServices = showcaseMode ? filteredServices.slice(0, 6) : filteredServices;
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
        adminFetchJson<{
          services?: ServiceRow[];
          categories?: string[];
          starterMinActiveServicePricePence?: number | null;
        }>('/api/admin/services', {
          errorMessage: 'Unable to load services.',
        }),
        adminFetchJson<{ barbers?: BarberListRow[] }>('/api/admin/barbers', {
          errorMessage: 'Unable to load barbers.',
        })
      ]);

      setServices(servicesData.services ?? []);
      setAvailableCategories(servicesData.categories ?? []);
      setStarterMinActiveServicePricePence(
        typeof servicesData.starterMinActiveServicePricePence === 'number'
          ? servicesData.starterMinActiveServicePricePence
          : null,
      );
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

  useEffect(() => {
    if (!openCreateOnMount || addIntentConsumedRef.current) return;
    if (loading) return;
    addIntentConsumedRef.current = true;
    if (!isPublicAdminDemoMode()) {
      setEditingId(null);
      setError('');
      setMessage('');
      setIsServiceSheetOpen(true);
    }
    stripAdminAddQueryFromUrl();
  }, [openCreateOnMount, loading]);

  function startEdit(service: ServiceRow) {
    if (isPublicAdminDemoMode()) {
      notifyAdminDemoBlocked();
      return;
    }
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

  const editingService = editingId ? services.find((s) => s.id === editingId) ?? null : null;

  const serviceUpdatedLabel = (service: ServiceRow) =>
    service.updatedAt || service.createdAt
      ? new Date(service.updatedAt ?? service.createdAt ?? '').toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Europe/London',
        })
      : '—';

  const serviceFeaturedButton = (service: ServiceRow) => {
    const featured = service.featured ?? false;
    return (
      <button
        type="button"
        className={`adt-icon-btn admin-product-row__featured-btn${featured ? ' is-on' : ''}`}
        role="switch"
        aria-checked={featured}
        aria-label={`${service.name}: ${featured ? 'Featured' : 'Not featured'}`}
        disabled={Boolean(serviceSavingById[service.id])}
        onClick={() => void toggleFeatured(service)}
        title={featured ? 'Featured — click to unfeature' : 'Feature on your booking page'}
      >
        <Star strokeWidth={featured ? 0 : 2} style={featured ? { fill: 'currentColor' } : undefined} aria-hidden="true" />
      </button>
    );
  };

  const serviceStatusPill = (service: ServiceRow) => (
    <ServiceStatusPill
      on={service.isActive}
      disabled={Boolean(serviceSavingById[service.id])}
      ariaLabel={`${service.name}: ${service.isActive ? 'Active' : 'Inactive'}`}
      onClick={() => void toggleActive(service)}
    />
  );

  const serviceColumns: AdminDataTableColumn<ServiceRow>[] = [
    {
      id: 'thumb',
      header: '',
      srHeader: 'Image',
      width: '2.75rem',
      mobile: 'lead',
      cell: (service) => (
        <span className="adt-thumb">
          {service.imageUrl ? (
            <img src={service.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} />
          ) : (
            <Scissors aria-hidden="true" />
          )}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Service',
      width: 'minmax(11rem, 1.5fr)',
      sortable: true,
      mobile: 'primary',
      cell: (service) => {
        const statusLine = serviceSavingById[service.id] ? 'Saving…' : serviceStatusById[service.id] || '';
        return (
          <AdminTableIdentity
            title={service.name}
            subtitle={statusLine || formatCategoryLabel(service.category)}
          />
        );
      },
    },
    {
      id: 'duration',
      header: 'Duration',
      width: '5.5rem',
      mobile: 'hidden',
      cell: (service) => <span className="adt-num">{service.durationMinutes} min</span>,
    },
    {
      id: 'description',
      header: 'Description',
      width: 'minmax(8rem, 2fr)',
      mobile: 'hidden',
      cell: (service) =>
        service.description ? (
          <span className="adt-truncate" title={service.description}>
            {service.description}
          </span>
        ) : (
          <span className="adt-muted">—</span>
        ),
    },
    {
      id: 'updated',
      header: 'Updated',
      width: '6.5rem',
      sortable: true,
      mobile: 'hidden',
      cell: (service) => <span className="adt-muted">{serviceUpdatedLabel(service)}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      width: '5.5rem',
      align: 'end',
      sortable: true,
      mobile: 'hidden',
      cell: (service) => <span className="adt-num">{formatPrice(service.pricePence)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '7rem',
      mobile: 'hidden',
      cell: serviceStatusPill,
    },
    {
      id: 'mobileMeta',
      header: '',
      width: '0px',
      only: 'narrow',
      mobile: 'meta',
      cell: (service) => (
        <span className="adt-inline">
          <span className="adt-num">{formatPrice(service.pricePence)}</span>
          <span>· {service.durationMinutes} min</span>
          {serviceStatusPill(service)}
        </span>
      ),
    },
    {
      id: 'controls',
      header: '',
      srHeader: 'Actions',
      width: '5rem',
      align: 'end',
      mobile: 'end',
      cell: (service) => (
        <span className="adt-inline">
          {serviceFeaturedButton(service)}
          <button
            type="button"
            className="adt-icon-btn admin-product-row__edit-btn"
            aria-label={
              isPublicAdminDemoMode()
                ? 'Service settings — sample data is read-only'
                : `Edit ${service.name}`
            }
            title={
              isPublicAdminDemoMode()
                ? 'Service settings — sample data is read-only'
                : `Edit ${service.name}`
            }
            onClick={() => startEdit(service)}
          >
            <SettingsGearIcon className="admin-control-icon" aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <section className="surface booking-shell admin-services-shell admin-has-mobile-fab">
      <AdminSectionHeader
        title="Services"
        description="Service catalogue"
        metaBadge={`${services.length} services`}
        actions={<AdminAddButton label="Add service" onClick={openCreateServiceSheet} />}
      />

      <AdminDesktopDashHeroSlot />

      {message ? <p className="admin-inline-success">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      {!loading && services.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No services yet"
          description="Add the services customers can book, with prices and durations."
          action={<AdminAddButton label="Add your first service" onClick={openCreateServiceSheet} />}
        />
      ) : null}

      {services.length > 0 || loading ? (
        <AdminDataTable<ServiceRow>
          label="Services"
          className="admin-services-panel"
          rows={showcasedServices}
          columns={serviceColumns}
          getRowId={(service) => service.id}
          loading={servicesInitiallyLoading}
          skeletonRows={5}
          sort={{ id: serviceSortMode === 'newest' ? 'updated' : serviceSortMode, dir: serviceSortMode === 'name' ? 'asc' : 'desc' }}
          onSortChange={(id) => setServiceSortMode(id === 'updated' ? 'newest' : (id as ServiceSortMode))}
          onRowClick={(service) => startEdit(service)}
          rowActionLabel={(service) => `Edit ${service.name}`}
          rowAttributes={(service) => ({ 'data-service-id': service.id })}
          isRowMuted={(service) => !service.isActive}
          rowClassName={() => 'admin-product-row admin-product-row--service'}
          empty={
            <EmptyState
              icon={Search}
              title="No services match"
              description="Try adjusting your search or filter to find what you're looking for."
              variant="filtered"
            />
          }
          toolbar={
            <AdminTableToolbar
              search={
                <AdminPremiumSearchBar
                  className="admin-products-toolbar-search"
                  inputRef={serviceSearchInputRef}
                  value={serviceSearch}
                  onChange={setServiceSearch}
                  onClear={handleServiceSearchClear}
                  onKeyDown={(e) => e.key === 'Escape' && handleServiceSearchClear()}
                  placeholder="Search services…"
                  aria-label="Search services"
                  showKbdHint
                  searchShortcutHint="/"
                />
              }
              filters={
                <AdminTableFilters<ServiceFilter>
                  label="Service filters"
                  value={serviceFilter}
                  onChange={setServiceFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'featured', label: 'Featured' },
                  ]}
                />
              }
              count={`${filteredServices.length} services · ${featuredCount} featured`}
              end={
                <AdminTableSortSelect<ServiceSortMode>
                  label="Sort services"
                  value={serviceSortMode}
                  onChange={setServiceSortMode}
                  options={SERVICE_SORT_OPTIONS}
                />
              }
            />
          }
        />
      ) : null}

      <AdminMobileFab label="Add service" onClick={openCreateServiceSheet} context="services" />

      <AdminWizardSheetLayer
        open={isServiceSheetOpen}
        onDismiss={resetServiceFormState}
        ariaLabelledBy="admin-service-form-title"
        className="admin-service-sheet-layer"
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
            minimumActivePricePence={starterMinActiveServicePricePence}
            onAddCategory={handleAddCategory}
            onCancel={resetServiceFormState}
            onSaved={async ({ categories }) => {
              if (categories) setAvailableCategories(categories);
              await fetchServices();
            }}
          />
      </AdminWizardSheetLayer>

    </section>
  );
}