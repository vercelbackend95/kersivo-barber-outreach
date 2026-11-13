import React, { useCallback, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from '../lucide-react';

/**
 * One table for every admin list (booking history, clients, services, products, orders).
 *
 * Desktop: a CSS-grid table with sortable column headers.
 * Narrow containers (< 44rem, container query — no JS media queries, so SSR and
 * hydration always agree): each row collapses into a two-line card driven by each
 * column's `mobile` slot:
 *   lead    → avatar / thumbnail / checkbox column on the left
 *   primary → the row's title line
 *   meta    → small secondary lines under the title
 *   end     → right-hand column (price, status, actions)
 *   hidden  → not shown on narrow containers
 */

export type AdminDataTableMobileSlot = 'lead' | 'primary' | 'meta' | 'end' | 'hidden';

export type AdminDataTableColumn<Row> = {
  id: string;
  header: ReactNode;
  /** Grid track for this column, e.g. `minmax(12rem, 2fr)` or `7rem`. */
  width: string;
  align?: 'start' | 'end' | 'center';
  /** Header click sorts by this id. */
  sortable?: boolean;
  /** Header label for screen readers when `header` is not plain text. */
  srHeader?: string;
  mobile?: AdminDataTableMobileSlot;
  /** Only render on wide or narrow layouts (e.g. a combined subtitle for phones). */
  only?: 'wide' | 'narrow';
  className?: string;
  cell: (row: Row) => ReactNode;
};

export type AdminDataTableSort = {
  id: string;
  dir: 'asc' | 'desc';
};

type RowAttributes = Record<`data-${string}`, string | undefined> & { id?: string };

export type AdminDataTableProps<Row> = {
  label: string;
  rows: Row[];
  columns: AdminDataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  /** Toolbar rendered above the header row (search, filters, sort). */
  toolbar?: ReactNode;
  /** Bar rendered between toolbar and header (active filters, bulk actions). */
  subToolbar?: ReactNode;
  footer?: ReactNode;
  sort?: AdminDataTableSort | null;
  onSortChange?: (id: string) => void;
  loading?: boolean;
  skeletonRows?: number;
  error?: ReactNode;
  empty?: ReactNode;
  onRowClick?: (row: Row) => void;
  /** Accessible label for the row's primary action (row click / Enter). */
  rowActionLabel?: (row: Row) => string;
  isRowExpanded?: (row: Row) => boolean;
  renderExpanded?: (row: Row) => ReactNode;
  isRowSelected?: (row: Row) => boolean;
  rowClassName?: (row: Row) => string | undefined;
  rowAttributes?: (row: Row) => RowAttributes;
  /** Rows dimmed (inactive service, hidden product, cancelled booking). */
  isRowMuted?: (row: Row) => boolean;
  className?: string;
  /** Hide the header row (e.g. while empty). Defaults to hiding when there are no rows. */
  hideHeader?: boolean;
  density?: 'comfortable' | 'compact';
};

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label, [role="button"], [role="switch"], [data-adt-stop]';

function alignClass(align: AdminDataTableColumn<unknown>['align']): string {
  if (align === 'end') return ' adt-cell--end';
  if (align === 'center') return ' adt-cell--center';
  return '';
}

export default function AdminDataTable<Row>({
  label,
  rows,
  columns,
  getRowId,
  toolbar,
  subToolbar,
  footer,
  sort = null,
  onSortChange,
  loading = false,
  skeletonRows = 6,
  error,
  empty,
  onRowClick,
  rowActionLabel,
  isRowExpanded,
  renderExpanded,
  isRowSelected,
  rowClassName,
  rowAttributes,
  isRowMuted,
  className = '',
  hideHeader,
  density = 'comfortable',
}: AdminDataTableProps<Row>) {
  // Narrow-only columns are display:none on wide layouts, so they must not own a track.
  const template = columns
    .filter((column) => column.only !== 'narrow')
    .map((column) => column.width)
    .join(' ');
  const style = { '--adt-cols': template } as React.CSSProperties;
  const showHeader = hideHeader === undefined ? loading || rows.length > 0 : !hideHeader;

  const activate = useCallback(
    (row: Row, event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
      if (!onRowClick) return;
      const target = event.target as HTMLElement | null;
      const interactive = target?.closest?.(INTERACTIVE_SELECTOR);
      if (interactive && interactive !== event.currentTarget) return;
      onRowClick(row);
    },
    [onRowClick],
  );

  const body = (() => {
    if (loading) {
      return (
        <div className="adt-body" aria-busy="true" aria-label={`Loading ${label.toLowerCase()}`}>
          {Array.from({ length: skeletonRows }, (_, index) => (
            <div key={index} className="adt-row adt-row--skeleton" aria-hidden="true">
              {columns.map((column) => (
                <span
                  key={column.id}
                  className={`adt-cell${alignClass(column.align)}`}
                  data-mobile={column.mobile ?? 'hidden'}
                  data-only={column.only}
                >
                  <span
                    className={`adt-skeleton${column.mobile === 'lead' ? ' adt-skeleton--lead' : ''}`}
                    style={{ width: column.mobile === 'lead' ? undefined : `${48 + ((index * 17 + column.id.length * 11) % 40)}%` }}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      );
    }
    if (error) return <div className="adt-state adt-state--error" role="alert">{error}</div>;
    if (rows.length === 0) return <div className="adt-state">{empty}</div>;

    return (
      <div className="adt-body" role="rowgroup">
        {rows.map((row) => {
          const id = getRowId(row);
          const expanded = Boolean(isRowExpanded?.(row));
          const selected = Boolean(isRowSelected?.(row));
          const muted = Boolean(isRowMuted?.(row));
          const attrs = rowAttributes?.(row) ?? {};
          const classes = [
            'adt-row',
            onRowClick ? 'adt-row--interactive' : '',
            expanded ? 'adt-row--expanded' : '',
            selected ? 'adt-row--selected' : '',
            muted ? 'adt-row--muted' : '',
            rowClassName?.(row) ?? '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={id}
              {...attrs}
              className={classes}
              role="row"
              aria-selected={isRowSelected ? selected : undefined}
              aria-expanded={renderExpanded ? expanded : undefined}
              aria-label={rowActionLabel?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? (event) => activate(row, event) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate(row, event);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <div
                  key={column.id}
                  role="cell"
                  className={`adt-cell${alignClass(column.align)}${column.className ? ` ${column.className}` : ''}`}
                  data-mobile={column.mobile ?? 'hidden'}
                  data-only={column.only}
                >
                  {column.cell(row)}
                </div>
              ))}
              {renderExpanded ? (
                <div
                  className={`adt-expand${expanded ? ' adt-expand--open' : ''}`}
                  aria-hidden={!expanded}
                  inert={!expanded ? true : undefined}
                  data-adt-stop=""
                >
                  <div className="adt-expand-inner">{expanded ? renderExpanded(row) : null}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <section
      className={`adt adt--${density}${className ? ` ${className}` : ''}`}
      aria-label={label}
      style={style}
    >
      {toolbar ? <div className="adt-toolbar">{toolbar}</div> : null}
      {subToolbar ? <div className="adt-subtoolbar">{subToolbar}</div> : null}
      <div className="adt-table" role="table" aria-label={label} aria-busy={loading || undefined}>
        {showHeader ? (
          <div className="adt-head" role="rowgroup">
            <div className="adt-row adt-row--head" role="row">
              {columns.map((column) => {
                const isSorted = sort?.id === column.id;
                const ariaSort = isSorted ? (sort?.dir === 'desc' ? 'descending' : 'ascending') : undefined;
                return (
                  <div
                    key={column.id}
                    role="columnheader"
                    aria-sort={column.sortable ? (ariaSort ?? 'none') : undefined}
                    className={`adt-cell adt-cell--head${alignClass(column.align)}`}
                    data-mobile={column.mobile ?? 'hidden'}
                    data-only={column.only}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className={`adt-sort${isSorted ? ' adt-sort--active' : ''}`}
                        onClick={() => onSortChange(column.id)}
                      >
                        <span>{column.header}</span>
                        <span className="adt-sort-icon" aria-hidden="true">
                          {isSorted && sort?.dir === 'desc' ? (
                            <ChevronDown width={12} height={12} />
                          ) : (
                            <ChevronUp width={12} height={12} />
                          )}
                        </span>
                      </button>
                    ) : column.header ? (
                      <span>{column.header}</span>
                    ) : (
                      <span className="sr-only">{column.srHeader ?? column.id}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {body}
      </div>
      {footer ? <div className="adt-footer">{footer}</div> : null}
    </section>
  );
}

/* ── Toolbar parts ─────────────────────────────────────────────────────────── */

export type AdminTableFilterOption<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
};

export function AdminTableFilters<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: AdminTableFilterOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div className="adt-filters" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`adt-filter${value === option.value ? ' adt-filter--active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' ? <span className="adt-filter-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function AdminTableSortSelect<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <label className="adt-sort-select">
      <span className="adt-sort-select-label">Sort</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as Value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="adt-sort-select-chevron" width={12} height={12} aria-hidden="true" />
    </label>
  );
}

export function AdminTableToolbar({
  search,
  filters,
  end,
  count,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  end?: ReactNode;
  count?: ReactNode;
}) {
  return (
    <div className="adt-toolbar-row">
      {search ? <div className="adt-toolbar-search">{search}</div> : null}
      {filters ? <div className="adt-toolbar-filters">{filters}</div> : null}
      {count || end ? (
        <div className="adt-toolbar-end">
          {count ? <span className="adt-count" aria-live="polite">{count}</span> : null}
          {end}
        </div>
      ) : null}
    </div>
  );
}

/* ── Cell parts ────────────────────────────────────────────────────────────── */

export function AdminTableIdentity({
  title,
  subtitle,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <span className="adt-identity">
      <span className="adt-identity-title">
        <span className="adt-identity-name">{title}</span>
        {badge}
      </span>
      {subtitle ? <span className="adt-identity-sub">{subtitle}</span> : null}
    </span>
  );
}

export type AdminTableStatusTone = 'ok' | 'warn' | 'info' | 'violet' | 'danger' | 'neutral' | 'brand';

/** On/off pill (service active, product live) — a real switch with a status dot. */
export function AdminTableSwitchPill({
  on,
  onLabel,
  offLabel,
  ariaLabel,
  disabled,
  onClick,
  className = '',
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      title={on ? `${onLabel} — click to switch off` : `${offLabel} — click to switch on`}
      className={`adt-status adt-status--button adt-status--switch adt-status--${on ? 'ok' : 'neutral'}${className ? ` ${className}` : ''}`}
    >
      <span className="adt-status-dot" aria-hidden="true" />
      {on ? onLabel : offLabel}
    </button>
  );
}

export function AdminTableStatus({
  tone,
  children,
  as = 'span',
  ...rest
}: {
  tone: AdminTableStatusTone;
  children: ReactNode;
  as?: 'span' | 'button';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  if (as === 'button') {
    return (
      <button type="button" {...rest} className={`adt-status adt-status--${tone} adt-status--button${rest.className ? ` ${rest.className}` : ''}`}>
        <span className="adt-status-dot" aria-hidden="true" />
        {children}
        <ChevronDown className="adt-status-chevron" width={11} height={11} aria-hidden="true" />
      </button>
    );
  }
  return (
    <span className={`adt-status adt-status--${tone}`}>
      <span className="adt-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
