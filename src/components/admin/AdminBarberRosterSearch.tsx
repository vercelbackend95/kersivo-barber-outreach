import React, { type RefObject } from 'react';
import { X } from '../lucide-react';

type AdminBarberRosterSearchProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  resultsLabel?: string;
  showKbdHint: boolean;
  searchShortcutHint: string;
};

export default function AdminBarberRosterSearch({
  searchInputRef,
  query,
  onQueryChange,
  onClear,
  resultsLabel,
  showKbdHint,
  searchShortcutHint,
}: AdminBarberRosterSearchProps) {
  return (
    <div className="admin-search-row admin-search-row--in-ops">
      <div
        className={`admin-search-field admin-search-field--premium admin-search-bar${query ? ' admin-search-field--has-clear' : ''}${resultsLabel ? ' admin-search-field--has-feedback' : ''}`}
        role="search"
      >
        <svg
          className="admin-search-bar__icon"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchInputRef}
          type="search"
          className="admin-search-bar__input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search barbers by name or service…"
          aria-label="Search barbers by name or service"
        />
        {resultsLabel ? (
          <span className="admin-search-feedback admin-search-feedback--premium" aria-live="polite">
            {resultsLabel}
          </span>
        ) : null}
        {query ? (
          <button type="button" className="admin-search-bar__clear" onClick={onClear} aria-label="Clear search">
            <X width={14} height={14} aria-hidden="true" />
          </button>
        ) : null}
        {!query && !resultsLabel && showKbdHint ? (
          <kbd className="admin-search-bar__kbd">
            <span className="sr-only">Keyboard shortcut to focus search</span>
            {searchShortcutHint}
          </kbd>
        ) : null}
      </div>
    </div>
  );
}
