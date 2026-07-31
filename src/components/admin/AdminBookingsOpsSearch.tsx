import React, { type ReactNode, type RefObject } from 'react';
import { X } from '../lucide-react';
import AdminPremiumSearchBar from './AdminPremiumSearchBar';

export type AdminBookingsOpsSearchBooking = {
  id: string;
  fullName: string;
  /** Null when the viewer is not allowed to see the client's email. */
  email: string | null;
  startAt: string;
  service?: { name: string } | null;
  barber?: { name: string } | null;
};

type AdminBookingsOpsSearchProps = {
  variant: 'standard' | 'compact';
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchResultsRef: RefObject<HTMLDivElement | null>;
  clientSearchQuery: string;
  onClientSearchQueryChange: (value: string) => void;
  searchDropdownBookings: AdminBookingsOpsSearchBooking[];
  searchResultsLabel: string;
  /** When true, show skeleton in the dropdown instead of stale results (e.g. history API fetch). */
  searchResultsLoading?: boolean;
  activeSearchResultIndex: number;
  onActiveSearchResultIndexChange: (update: (current: number) => number) => void;
  highlightMatch: (value: string) => ReactNode;
  formatStartTime: (startAt: string) => string;
  onSelectBooking: (booking: AdminBookingsOpsSearchBooking) => void;
  onClearSearch: () => void;
  showKbdHint: boolean;
  searchShortcutHint: string;
};

export default function AdminBookingsOpsSearch({
  variant,
  searchInputRef,
  searchResultsRef,
  clientSearchQuery,
  onClientSearchQueryChange,
  searchDropdownBookings,
  searchResultsLabel,
  searchResultsLoading = false,
  activeSearchResultIndex,
  onActiveSearchResultIndexChange,
  highlightMatch,
  formatStartTime,
  onSelectBooking,
  onClearSearch,
  showKbdHint,
  searchShortcutHint
}: AdminBookingsOpsSearchProps) {
  const searchWrapClass = 'admin-search-row admin-search-row--in-ops';
  const showSearchDropdown =
    searchDropdownBookings.length > 0 || (searchResultsLoading && clientSearchQuery.trim().length > 0);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchDropdownBookings.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onActiveSearchResultIndexChange((current) => (current + 1) % searchDropdownBookings.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onActiveSearchResultIndexChange((current) => {
        if (current <= 0) return searchDropdownBookings.length - 1;
        return current - 1;
      });
      return;
    }
    if (event.key === 'Enter' && activeSearchResultIndex >= 0) {
      event.preventDefault();
      const selectedBooking = searchDropdownBookings[activeSearchResultIndex];
      if (selectedBooking) onSelectBooking(selectedBooking);
    }
  };

  const placeholder = variant === 'standard'
    ? 'Search clients, services, times…'
    : 'Search name, email or barber…';

  const searchResults = showSearchDropdown ? (
    <div
      className="admin-search-results"
      id="admin-booking-search-results"
      ref={searchResultsRef}
      role={searchResultsLoading ? 'status' : 'listbox'}
      aria-live={searchResultsLoading ? 'polite' : undefined}
      aria-label={searchResultsLoading ? 'Loading search results' : undefined}
    >
      {searchResultsLoading ? (
        <div className="admin-search-results__skeleton" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="admin-search-results__skeleton-row">
              <span className="admin-search-results__skeleton-line admin-search-results__skeleton-line--main" />
              <span className="admin-search-results__skeleton-line admin-search-results__skeleton-line--meta" />
            </div>
          ))}
        </div>
      ) : (
        searchDropdownBookings.map((booking, index) => (
          <button
            type="button"
            key={booking.id}
            id={`admin-search-result-${booking.id}`}
            data-search-result-index={index}
            role="option"
            aria-selected={activeSearchResultIndex === index}
            className={`admin-search-result-item ${activeSearchResultIndex === index ? 'is-active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelectBooking(booking)}
          >
            <span className="admin-search-result-main">{highlightMatch(booking.fullName)}</span>
            <span className="admin-search-result-meta">
              {highlightMatch(booking.email ?? '')} · {highlightMatch(booking.service?.name ?? '')} ·{' '}
              {highlightMatch(booking.barber?.name ?? '')} · {formatStartTime(booking.startAt)}
            </span>
          </button>
        ))
      )}
    </div>
  ) : null;

  const inputAriaProps = {
    'aria-label': 'Search bookings by client name, email, barber, service, time, or booking reference',
    'aria-controls': 'admin-booking-search-results',
    'aria-expanded': showSearchDropdown,
    'aria-busy': searchResultsLoading || undefined,
    'aria-activedescendant': searchResultsLoading
      ? undefined
      : activeSearchResultIndex >= 0
        ? `admin-search-result-${searchDropdownBookings[activeSearchResultIndex]?.id}`
        : undefined,
  };

  const standardInner = (
    <>
      <div className={searchWrapClass}>
        <div
          className={`admin-search-field ${clientSearchQuery ? 'admin-search-field--has-clear' : ''} ${searchResultsLabel ? 'admin-search-field--has-feedback' : ''}`}
        >
          <span className="admin-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                d="M10.5 3a7.5 7.5 0 0 1 5.975 12.034l4.245 4.246a1 1 0 1 1-1.414 1.414l-4.246-4.245A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={clientSearchQuery}
            onChange={(event) => onClientSearchQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            {...inputAriaProps}
          />
          {searchResultsLabel ? (
            <span className="admin-search-feedback" aria-live="polite">
              {searchResultsLabel}
            </span>
          ) : null}
          {clientSearchQuery ? (
            <button type="button" className="admin-search-clear" onClick={onClearSearch} aria-label="Clear search">
              <X width={12} height={12} aria-hidden="true" />
            </button>
          ) : null}
          {searchResults}
        </div>
      </div>
      {showKbdHint ? (
        <span className="admin-search-kbd-hint">
          <span className="sr-only">Keyboard shortcut to focus search</span>
          <kbd className="admin-kbd">{searchShortcutHint}</kbd>
        </span>
      ) : null}
    </>
  );

  if (variant === 'standard') {
    return <div className="admin-bookings-ops-search admin-bookings-ops-search--dashboard">{standardInner}</div>;
  }

  return (
    <AdminPremiumSearchBar
      inputRef={searchInputRef}
      value={clientSearchQuery}
      onChange={onClientSearchQueryChange}
      onClear={onClearSearch}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={inputAriaProps['aria-label']}
      resultsLabel={searchResultsLabel || undefined}
      showKbdHint={showKbdHint}
      searchShortcutHint={searchShortcutHint}
      inputProps={{
        'aria-controls': inputAriaProps['aria-controls'],
        'aria-expanded': inputAriaProps['aria-expanded'],
        'aria-busy': inputAriaProps['aria-busy'],
        'aria-activedescendant': inputAriaProps['aria-activedescendant'],
      }}
    >
      {searchResults}
    </AdminPremiumSearchBar>
  );
}
