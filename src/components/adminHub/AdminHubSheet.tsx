import { useEffect, useId, useRef, type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps } from 'react';
import { MessageCircle, X } from '@/components/lucide-react';
import { ADMIN_HUB_APP_CLOSE } from '@/lib/adminHub/copy';

type SheetIcon = ComponentType<SVGProps<SVGSVGElement>>;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

export function AdminHubSheet(props: {
  title: string;
  crumb?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  icon?: SheetIcon;
  testId?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const Icon = props.icon ?? MessageCircle;
  const sheet =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 1023px)').matches
      : false;

  useEffect(() => {
    const node = dialogRef.current;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      props.onClose();
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [props.onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

  return (
    <div className="admin-hub-app-root">
      <div className="admin-hub-app__scrim" aria-hidden="true" onClick={props.onClose} />
      <div
        ref={dialogRef}
        className={`admin-hub-app${sheet ? ' admin-hub-app--sheet' : ' admin-hub-app--window'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={props.testId ?? 'admin-hub-suggest'}
        tabIndex={-1}
        style={sheet ? undefined : { maxWidth: 720 }}
        onKeyDown={onKeyDown}
      >
        {sheet ? <span className="admin-hub-app__grab" aria-hidden="true" /> : null}
        <header className="admin-hub-app__bar">
          <span className="admin-hub-app__icon" aria-hidden="true">
            <Icon width={16} height={16} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="admin-hub-app__title" id={titleId}>
              {props.title}
            </h2>
            {props.crumb ? <p className="admin-hub-app__crumb">{props.crumb}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="admin-hub-app__close"
            aria-label={ADMIN_HUB_APP_CLOSE}
            onClick={props.onClose}
          >
            <X width={18} height={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>
        <div className="admin-hub-app__body">{props.children}</div>
        {props.footer ? <div className="admin-hub-app__foot">{props.footer}</div> : null}
      </div>
    </div>
  );
}
