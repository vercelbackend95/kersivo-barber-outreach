import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSectionHeader from './AdminSectionHeader';
import ClientProfilePanel from './ClientProfilePanel';

type ClientListRow = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  tags: string[];
  reliabilityScore: number;
  lastVisitAt: string | null;
  totalSpentPence: number;
  totalBookings: number;
  completedCount: number;
  noShowCount: number;
};

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openClientId, setOpenClientId] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(val.trim());
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
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
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json() as Promise<{ clients: ClientListRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setClients(data.clients ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load clients.');
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

      <div className="admin-clients-search-row">
        <input
          type="search"
          className="input admin-clients-search-input"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={handleSearchChange}
          aria-label="Search clients"
        />
      </div>

      <div className="admin-clients-table-wrap">
        {/* Column header */}
        <div className="admin-clients-header-row" aria-hidden="true">
          <span />
          <span>Client</span>
          <span>Phone</span>
          <span>Tags</span>
          <span>Reliability</span>
          <span>Last visit</span>
          <span>Total spent</span>
        </div>

        {loading ? (
          <div className="admin-clients-loading" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="admin-clients-skeleton-row" aria-hidden="true">
                <span className="admin-clients-skeleton-avatar" />
                <span className="admin-clients-skeleton-cell admin-clients-skeleton-cell--name" />
                <span className="admin-clients-skeleton-cell" />
                <span className="admin-clients-skeleton-cell" />
                <span className="admin-clients-skeleton-cell admin-clients-skeleton-cell--bar" />
                <span className="admin-clients-skeleton-cell" />
                <span className="admin-clients-skeleton-cell" />
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
              const initials = getInitials(client.fullName);
              const tone = reliabilityTone(client.reliabilityScore);
              const visibleTags = client.tags.slice(0, MAX_VISIBLE_TAGS);
              const hiddenTagCount = client.tags.length - visibleTags.length;
              const displayName = client.fullName || client.email;

              return (
                <li key={client.id}>
                  <button
                    type="button"
                    className="admin-clients-row"
                    onClick={() => setOpenClientId(client.id)}
                    aria-label={`View profile for ${displayName}`}
                  >
                    {/* Avatar */}
                    <div className="admin-clients-avatar" aria-hidden="true">
                      <span className="admin-clients-avatar-initials">{initials}</span>
                    </div>

                    {/* Name + email */}
                    <div className="admin-clients-identity">
                      <span className="admin-clients-name">{displayName}</span>
                      <span className="admin-clients-email">{client.email}</span>
                    </div>

                    {/* Phone */}
                    <span className="admin-clients-phone">
                      {client.phone || '—'}
                    </span>

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

                    {/* Total spent */}
                    <span className="admin-clients-spent">
                      {client.totalSpentPence > 0 ? formatPence(client.totalSpentPence) : '—'}
                    </span>
                  </button>
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
