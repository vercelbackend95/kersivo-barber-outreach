import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSectionHeader from './AdminSectionHeader';
import AdminDesktopDashHeroSlot from './AdminDesktopDashHeroSlot';
import AdminPremiumSearchBar from './AdminPremiumSearchBar';
import ClientListAvatar from './ClientListAvatar';
import ClientProfilePanel from './ClientProfilePanel';

type ClientListRow = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  tags: string[];
  avatarUrl?: string | null;
  reliabilityScore: number;
  lastVisitAt: string | null;
  totalSpentPence?: number;
  totalBookings: number;
  completedCount: number;
  noShowCount: number;
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
  });
}

function reliabilityTone(score: number): 'good' | 'medium' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'medium';
  return 'bad';
}

const MAX_VISIBLE_TAGS = 3;

const DEBOUNCE_MS = 280;

export default function ClientsAdminPanel() {
  const [clients, setClients] = useState<ClientListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTotalSpent, setShowTotalSpent] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [openClientId, setOpenClientId] = useState<string | null>(null);

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
        return r.json() as Promise<{ clients: ClientListRow[]; financialsHidden?: boolean }>;
      })
      .then((data) => {
        if (!cancelled) {
          setClients(data.clients ?? []);
          setShowTotalSpent(data.financialsHidden !== true);
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
  }, [debouncedSearch]);

  return (
    <section className="surface booking-shell admin-clients-section" aria-label="Clients">
      <AdminSectionHeader
        title="Clients"
        description="Manage your client list, tags and reliability scores"
        metaBadge={!loading && !error ? String(clients.length) : undefined}
      />

      <AdminDesktopDashHeroSlot />

      <div
        className={`admin-clients-table-wrap${showTotalSpent ? '' : ' admin-clients-table-wrap--no-spent'}`}
      >
        <div className="admin-clients-search-row">
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
        </div>

        {/* Column header */}
        <div className="admin-clients-header-row" aria-hidden="true">
          <span />
          <span>Client</span>
          <span>Tags</span>
          <span>Reliability</span>
          <span>Last visit</span>
          {showTotalSpent ? <span>Total spent</span> : null}
        </div>

        {loading ? (
          <div className="admin-clients-loading" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="admin-clients-skeleton-row" aria-hidden="true">
                <span className="admin-clients-skeleton-avatar" />
                <span className="admin-clients-skeleton-cell admin-clients-skeleton-cell--name" />
                <span className="admin-clients-skeleton-cell" />
                <span className="admin-clients-skeleton-cell admin-clients-skeleton-cell--bar" />
                <span className="admin-clients-skeleton-cell" />
                {showTotalSpent ? <span className="admin-clients-skeleton-cell" /> : null}
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="admin-clients-error">{error}</p>
        ) : clients.length === 0 ? (
          <p className="admin-clients-empty">
            {debouncedSearch ? 'No clients match your search.' : 'No clients yet.'}
          </p>
        ) : (
          <ul className="admin-clients-list" role="list">
            {clients.map((client) => {
              const tone = reliabilityTone(client.reliabilityScore);
              const visibleTags = client.tags.slice(0, MAX_VISIBLE_TAGS);
              const hiddenTagCount = client.tags.length - visibleTags.length;
              const displayName = client.fullName || client.email;

              return (
                <li key={client.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="admin-clients-row"
                    onClick={() => setOpenClientId(client.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpenClientId(client.id);
                      }
                    }}
                    aria-label={`View profile for ${displayName}`}
                  >
                    <ClientListAvatar
                      clientId={client.id}
                      fullName={client.fullName || client.email}
                      avatarUrl={client.avatarUrl}
                      className="admin-clients-avatar"
                      onClick={() => setOpenClientId(client.id)}
                    />

                    {/* Name + email */}
                    <div className="admin-clients-identity">
                      <span className="admin-clients-name">{displayName}</span>
                      <span className="admin-clients-email">{client.email}</span>
                    </div>

                    {/* Tags */}
                    <div className="admin-clients-tags">
                      {visibleTags.map((tag) => (
                        <span key={tag} className="admin-clients-tag-chip">{tag}</span>
                      ))}
                      {hiddenTagCount > 0 && (
                        <span className="admin-clients-tags-overflow">+{hiddenTagCount}</span>
                      )}
                      {client.tags.length === 0 && (
                        <span className="admin-clients-tags-none">—</span>
                      )}
                    </div>

                    {/* Reliability bar */}
                    <div className="admin-clients-reliability">
                      <div
                        className={`admin-clients-reliability-track admin-clients-reliability-track--${tone}`}
                        title={`${client.reliabilityScore} / 100`}
                      >
                        <div
                          className="admin-clients-reliability-fill"
                          style={{ width: `${client.reliabilityScore}%` }}
                        />
                      </div>
                      <span className="admin-clients-reliability-label">
                        {client.reliabilityScore}
                      </span>
                    </div>

                    {/* Last visit */}
                    <span className="admin-clients-last-visit">
                      {formatDate(client.lastVisitAt)}
                    </span>

                    {showTotalSpent ? (
                      <span className="admin-clients-spent">
                        {typeof client.totalSpentPence === 'number'
                          ? formatPence(client.totalSpentPence)
                          : '—'}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openClientId && (
        <ClientProfilePanel
          clientId={openClientId}
          onClose={() => setOpenClientId(null)}
        />
      )}
    </section>
  );
}
