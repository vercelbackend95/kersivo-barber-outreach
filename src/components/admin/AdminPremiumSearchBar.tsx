import React, { type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { X } from '../lucide-react';

export type AdminPremiumSearchBarProps = {
  inputRef?: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  'aria-label': string;
  resultsLabel?: string;
  isLoading?: boolean;
  showKbdHint?: boolean;
  searchShortcutHint?: string;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'onKeyDown' | 'placeholder' | 'className' | 'type' | 'disabled' | 'ref'
  >;
  children?: ReactNode;
};

export default function AdminPremiumSearchBar({
  inputRef,
  value,
  onChange,
  onClear,
  placeholder,
  'aria-label': ariaLabel,
  resultsLabel,
  isLoading = false,
  showKbdHint = false,
  searchShortcutHint = '/',
  className = '',
  disabled = false,
  onKeyDown,
  inputProps,
  children,
}: AdminPremiumSearchBarProps) {
  const hasClear = Boolean(value) && !isLoading;
  const hasFeedback = Boolean(resultsLabel);
  const showKbd = !value && !resultsLabel && !isLoading && showKbdHint;

  const fieldClass = [
    'admin-search-field',
    'admin-search-field--premium',
    'admin-search-bar',
    className,
    hasClear ? 'admin-search-field--has-clear' : '',
    hasFeedback ? 'admin-search-field--has-feedback' : '',
    isLoading ? 'admin-search-bar--loading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="admin-search-row admin-search-row--in-ops">
      <div className={fieldClass} role="search">
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
          ref={inputRef}
          type="search"
          className="admin-search-bar__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          {...inputProps}
        />
        {resultsLabel ? (
          <span className="admin-search-feedback admin-search-feedback--premium" aria-live="polite">
            {resultsLabel}
          </span>
        ) : null}
        {isLoading ? <span className="admin-search-bar__spinner" aria-hidden="true" /> : null}
        {hasClear ? (
          <button type="button" className="admin-search-bar__clear" onClick={onClear} aria-label="Clear search">
            <X width={14} height={14} aria-hidden="true" />
          </button>
        ) : null}
        {showKbd ? (
          <kbd className="admin-search-bar__kbd">
            <span className="sr-only">Keyboard shortcut to focus search</span>
            {searchShortcutHint}
          </kbd>
        ) : null}
        {children}
      </div>
    </div>
  );
}
