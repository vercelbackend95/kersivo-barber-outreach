import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminSectionHeader from './AdminSectionHeader';
import AdminDesktopDashHeroSlot from './AdminDesktopDashHeroSlot';
import AdminPremiumSearchBar from './AdminPremiumSearchBar';
import ClientListAvatar from './ClientListAvatar';
import ClientProfilePanel from './ClientProfilePanel';
import ClientCoreProfilePanel from './ClientCoreProfilePanel';
import AdminDataTable, {
  AdminTableIdentity,
  AdminTableToolbar,
  type AdminDataTableColumn,
  type AdminDataTableSort,
} from './AdminDataTable';
import EmptyState from '../EmptyState';
import { Search, User } from '../lucide-react';

type ClientListRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  tags?: string[];
  avatarUrl?: string | null;
  reliabilityScore?: number;
  lastVisitAt: string | null;
  nextBookingAt?: string | null;
  totalSpentPence?: number;
  totalBookings?: number;
  completedCount?: number;
  noShowCount?: number;
};

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

function reliabilityTone(score: number): 'good' | 'medium' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'medium';
  return 'bad';
}

const MAX_VISIBLE_TAGS = 3;

const DEBOUNCE_MS = 280;

export default function ClientsAdminPanel({ showcaseMode = false }: { showcaseMode?: boolean }) {
  const [clients, setClients] = useState<ClientListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTotalSpent, setShowTotalSpent] = useState(true);
  const [clientsMode, setClientsMode] = useState<'core' | 'advanced'>('advanced');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [sort, setSort] = useState<AdminDataTableSort>({ id: 'client', dir: 'asc' });

  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setIsSearching(true);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(value.trim());
      setIsSearching(false);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  const handleClear = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = null;
    setSearch('');
    setDebouncedSearch('');
    setIsSearching(false);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set('query', debouncedSearch);

    fetch(`/api/admin/clients${params.size ? `?${params.toString()}` : ''}`, {
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) {
          const payload = (await r.json().catch(() => null)) as
            | { error?: string; code?: string }
            | null;
          const message =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error.trim()
              : 'Could not load clients.';
          throw new Error(message);
        }
        return r.json() as Promise<{
          clients: ClientListRow[];
          mode?: 'core' | 'advanced';
          financialsHidden?: boolean;
        }>;
      })
      .then((data) => {
        if (!cancelled) {
          const mode = data.mode === 'core' ? 'core' : 'advanced';
          setClientsMode(mode);
          setClients(data.clients ?? []);
          setShowTotalSpent(mode === 'advanced' && data.financialsHidden !== true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load clients.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedSearch, listVersion]);

  const sortedClients = useMemo(() => {
    const list = [...clients];
    const dir = sort.dir === 'asc' ? 1 : -1;
    const name = (c: ClientListRow) => (c.fullName || c.email || c.phone || '').toLowerCase();
    const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
    list.sort((a, b) => {
      switch (sort.id) {
        case 'reliability':
          return ((a.reliabilityScore ?? 0) - (b.reliabilityScore ?? 0)) * dir;
        case 'lastVisit':
          return (time(a.lastVisitAt) - time(b.lastVisitAt)) * dir;
        case 'nextBooking':
          return (time(a.nextBookingAt) - time(b.nextBookingAt)) * dir;
        case 'spent':
          return ((a.totalSpentPence ?? 0) - (b.totalSpentPence ?? 0)) * dir;
        default:
          return name(a).localeCompare(name(b)) * dir;
      }
    });
    return list;
  }, [clients, sort]);

  const showcasedClients = showcaseMode ? sortedClients.slice(0, 8) : sortedClients;

  const handleSortChange = useCallback((id: string) => {
    setSort((current) =>
      current.id === id
        ? { id, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { id, dir: id === 'client' ? 'asc' : 'desc' },
    );
  }, []);

  const displayNameFor = (client: ClientListRow) => client.fullName || client.phone || client.email || 'Client';

  const avatarColumn: AdminDataTableColumn<ClientListRow> = {
    id: 'avatar',
    header: '',
    srHeader: 'Photo',
    width: '2.25rem',
    mobile: 'lead',
    cell: (client) => (
      <ClientListAvatar
        clientId={client.id}
        fullName={displayNameFor(client)}
        avatarUrl={clientsMode === 'advanced' ? client.avatarUrl : null}
        className="adt-avatar admin-clients-avatar"
        onClick={() => setOpenClientId(client.id)}
      />
    ),
  };

  const identityColumn: AdminDataTableColumn<ClientListRow> = {
    id: 'client',
    header: 'Client',
    width: 'minmax(12rem, 2.2fr)',
    sortable: true,
    mobile: 'primary',
    cell: (client) => (
      <AdminTableIdentity title={displayNameFor(client)} subtitle={client.email ?? client.phone ?? undefined} />
    ),
  };

  const columns: AdminDataTableColumn<ClientListRow>[] =
    clientsMode === 'core'
      ? [
          avatarColumn,
          identityColumn,
          {
            id: 'phone',
            header: 'Phone',
            width: 'minmax(8rem, 1fr)',
            mobile: 'hidden',
            cell: (client) => <span className="adt-truncate">{client.phone || '—'}</span>,
          },
          {
            id: 'lastVisit',
            header: 'Last visit',
            width: 'minmax(7rem, 0.9fr)',
            sortable: true,
            mobile: 'meta',
            cell: (client) => <span>Last visit {formatDate(client.lastVisitAt)}</span>,
          },
          {
            id: 'nextBooking',
            header: 'Next booking',
            width: 'minmax(7rem, 0.9fr)',
            sortable: true,
            mobile: 'hidden',
            cell: (client) => <span>{formatDate(client.nextBookingAt ?? null)}</span>,
          },
          {
            id: 'crm',
            header: 'Advanced CRM',
            width: 'minmax(8rem, 0.9fr)',
            align: 'end',
            mobile: 'hidden',
            cell: () => <span className="adt-badge adt-badge--brand">Full KERSIVO</span>,
          },
        ]
      : [
          avatarColumn,
          identityColumn,
          {
            id: 'tags',
            header: 'Tags',
            width: 'minmax(8rem, 1.2fr)',
            mobile: 'hidden',
            cell: (client) => {
              const tags = client.tags ?? [];
              const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
              const hiddenTagCount = tags.length - visibleTags.length;
              return tags.length === 0 ? (
                <span className="adt-muted">—</span>
              ) : (
                <span className="adt-tags">
                  {visibleTags.map((tag) => (
                    <span key={tag} className="adt-tag">{tag}</span>
                  ))}
                  {hiddenTagCount > 0 ? <span className="adt-tag">+{hiddenTagCount}</span> : null}
                </span>
              );
            },
          },
          {
            id: 'reliability',
            header: 'Reliability',
            width: 'minmax(7rem, 1fr)',
            sortable: true,
            mobile: 'hidden',
            cell: (client) => {
              const score = Math.max(0, Math.min(100, client.reliabilityScore ?? 0));
              return (
                <span className={`adt-meter adt-meter--${reliabilityTone(score)}`} title={`${score} / 100`}>
                  <span className="adt-meter-track">
                    <span className="adt-meter-fill" style={{ transform: `scaleX(${score / 100})` }} />
                  </span>
                  <span className="adt-meter-value">{score}</span>
                </span>
              );
            },
          },
          {
            id: 'lastVisit',
            header: 'Last visit',
            width: 'minmax(6.5rem, 0.8fr)',
            sortable: true,
            mobile: 'meta',
            cell: (client) => <span>{formatDate(client.lastVisitAt)}</span>,
          },
          ...(showTotalSpent
            ? [
                {
                  id: 'spent',
                  header: 'Total spent',
                  width: 'minmax(6rem, 0.7fr)',
                  align: 'end' as const,
                  sortable: true,
                  mobile: 'end' as const,
                  cell: (client: ClientListRow) => (
                    <span className="adt-num">
                      {typeof client.totalSpentPence === 'number' ? formatPence(client.totalSpentPence) : '—'}
                    </span>
                  ),
                },
              ]
            : []),
        ];

  return (
    <section className="surface booking-shell admin-clients-section" aria-label="Clients">
      <AdminSectionHeader
        title="Clients"
        description={
          clientsMode === 'core'
            ? 'Search client contacts and see recent operational booking context'
            : 'Manage your client list, tags and reliability scores'
        }
        metaBadge={!loading && !error ? String(clients.length) : undefined}
      />

      <AdminDesktopDashHeroSlot />

      <AdminDataTable<ClientListRow>
        label="Clients"
        className="admin-clients-table-wrap"
        rows={showcasedClients}
        columns={columns}
        getRowId={(client) => client.id}
        loading={loading}
        error={error}
        sort={sort}
        onSortChange={handleSortChange}
        onRowClick={(client) => setOpenClientId(client.id)}
        rowActionLabel={(client) => `View profile for ${displayNameFor(client)}`}
        rowAttributes={(client) => ({ 'data-client-id': client.id })}
        empty={
          <EmptyState
            icon={debouncedSearch ? Search : User}
            title={debouncedSearch ? 'No clients match your search' : 'No clients yet'}
            description={
              debouncedSearch
                ? 'Try a name, email address or phone number.'
                : 'Clients appear here automatically after their first booking.'
            }
            variant={debouncedSearch ? 'filtered' : undefined}
            action={
              debouncedSearch ? (
                <button type="button" className="adt-action" onClick={handleClear}>
                  Clear search
                </button>
              ) : undefined
            }
          />
        }
        toolbar={
          <AdminTableToolbar
            search={
              <AdminPremiumSearchBar
                inputRef={inputRef}
                value={search}
                onChange={handleSearchChange}
                onClear={handleClear}
                onKeyDown={(e) => e.key === 'Escape' && handleClear()}
                placeholder="Search by name, email or phone…"
                aria-label="Search clients"
                isLoading={isSearching}
                showKbdHint
                searchShortcutHint="/"
              />
            }
            count={!loading && !error ? `${clients.length} client${clients.length === 1 ? '' : 's'}` : undefined}
          />
        }
      />

      {openClientId && clientsMode === 'core' ? (
        <ClientCoreProfilePanel
          clientId={openClientId}
          onClose={() => setOpenClientId(null)}
          onErased={() => {
            setOpenClientId(null);
            setListVersion((version) => version + 1);
          }}
        />
      ) : null}

      {openClientId && clientsMode === 'advanced' ? (
        <ClientProfilePanel
          clientId={openClientId}
          onClose={() => setOpenClientId(null)}
          onErased={() => {
            setOpenClientId(null);
            setListVersion((version) => version + 1);
          }}
        />
      ) : null}
    </section>
  );
}
