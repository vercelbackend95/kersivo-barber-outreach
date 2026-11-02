import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

export function AdminHubConfirmDialog(props: {
  title: string;
  body: string;
  children?: ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  testId?: string;
}) {
  const titleId = useId();
  const bodyId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  const busy = Boolean(props.busy);

  useEffect(() => {
    const previous = document.activeElement;
    const frame = window.requestAnimationFrame(() => primaryRef.current?.focus());
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const list = focusables(dialogRef.current);
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [busy]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="admin-hub-confirm-root">
      <div
        className="admin-hub-confirm__scrim"
        aria-hidden="true"
        onClick={() => {
          if (!busy) props.onClose();
        }}
      />
      <div
        ref={dialogRef}
        className="admin-hub-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={busy || undefined}
        data-testid={props.testId ?? 'admin-hub-confirm'}
        tabIndex={-1}
      >
        <h2 className="admin-hub-confirm__title" id={titleId}>
          {props.title}
        </h2>
        <p className="admin-hub-confirm__body" id={bodyId}>
          {props.body}
        </p>
        {props.children}
        {props.error ? (
          <p className="admin-hub-confirm__error" id={errorId} role="alert">
            {props.error}
          </p>
        ) : null}
        <div className="admin-hub-confirm__actions">
          <button type="button" className="btn btn--outline" disabled={busy} onClick={props.onClose}>
            {props.secondaryLabel}
          </button>
          <button
            ref={primaryRef}
            type="button"
            className="btn btn--primary"
            disabled={busy}
            aria-describedby={props.error ? errorId : undefined}
            onClick={props.onConfirm}
          >
            {busy ? (props.busyLabel ?? props.primaryLabel) : props.primaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
