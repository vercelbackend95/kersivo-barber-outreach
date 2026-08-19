import React, { useEffect, useId, useRef } from 'react';

export type BookingSummaryRow = {
  label: string;
  value: string;
  empty?: boolean;
};

type Props = {
  rows: BookingSummaryRow[];
  compactLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showSheetTrigger: boolean;
};

export default function BookingSummary({ rows, compactLabel, open, onOpenChange, showSheetTrigger }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      openerRef.current?.focus();
    };
  }, [open, onOpenChange]);

  return (
    <>
      <aside className="bx-summary" aria-labelledby="booking-summary-title">
        <p className="bx-summary__eyebrow">Summary</p>
        <h2 id="booking-summary-title">Your booking</h2>
        <dl className="bx-summary__list">
          {rows.map((row) => (
            <div className={`bx-summary__row${row.empty ? ' is-empty' : ''}`} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      {showSheetTrigger ? (
        <button
          ref={openerRef}
          type="button"
          className="bx-summary-trigger"
          onClick={() => onOpenChange(true)}
        >
          <span>{compactLabel || 'View summary'}</span>
          <strong>View summary</strong>
        </button>
      ) : null}

      {open ? (
        <div className="bx-sheet" role="presentation">
          <button
            type="button"
            className="bx-sheet__backdrop"
            aria-label="Close summary"
            onClick={() => onOpenChange(false)}
          />
          <div className="bx-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="bx-sheet__head">
              <h2 id={titleId}>Your booking</h2>
              <button ref={closeRef} type="button" className="bx-sheet__close" onClick={() => onOpenChange(false)}>
                Close
              </button>
            </div>
            <dl className="bx-summary__list">
              {rows.map((row) => (
                <div className={`bx-summary__row${row.empty ? ' is-empty' : ''}`} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}
