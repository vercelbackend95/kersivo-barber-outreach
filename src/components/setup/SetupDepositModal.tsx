import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { SetupPlanId } from '@/lib/setup/plans';

import '@/styles/components/inputs.css';
import '@/styles/components/setup-deposit-modal.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SHOP_SIZE_OPTIONS = [
  { value: '1-2', label: '1-2 chairs' },
  { value: '3-4', label: '3-4 chairs' },
  { value: '5-6', label: '5-6 chairs' },
  { value: '7-8', label: '7-8 chairs' },
  { value: '9+', label: '9+ chairs' },
] as const;

const CURRENT_STACK_OPTIONS = [
  { value: 'booksy', label: 'Booksy' },
  { value: 'fresha', label: 'Fresha' },
  { value: 'other-app', label: 'Other app' },
  { value: 'mixed-manual', label: 'Mixed/manual' },
  { value: 'none', label: 'No booking system' },
] as const;

export type SetupDepositModalProps = {
  open: boolean;
  onClose: () => void;
  planId: SetupPlanId;
  planName: string;
  depositFormatted: string;
};

export function SetupDepositModal({
  open,
  onClose,
  planId,
  planName,
  depositFormatted,
}: SetupDepositModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopSize, setShopSize] = useState('');
  const [currentStack, setCurrentStack] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitError(null);
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialogNode = dialogRef.current;

    const focusName = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogNode) return;

      const focusable = Array.from(
        dialogNode.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusName);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const validate = (): string | null => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedShopName = shopName.trim();

    if (trimmedName.length < 2) return 'Name must be at least 2 characters.';
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) return 'Valid email is required.';
    if (trimmedShopName.length < 2) return 'Shop name must be at least 2 characters.';
    if (!shopSize) return 'Shop size is required.';
    if (!currentStack) return 'Current stack is required.';
    if (!termsAccepted) return 'Please accept the Terms to continue.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setLoading(true);

    try {
      const attribution: Record<string, string> = {};
      try {
        const params = new URLSearchParams(window.location.search);
        for (const key of [
          'gclid',
          'gbraid',
          'wbraid',
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_term',
        ] as const) {
          const value = params.get(key)?.trim();
          if (value) attribution[key] = value.slice(0, 200);
        }
      } catch {
        // ignore attribution collection failures
      }

      const response = await fetch('/api/setup/deposit-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          shopName: shopName.trim(),
          shopSize,
          currentStack,
          attribution,
          termsAccepted: true,
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to start checkout.');
      }

      if (!data.url || typeof data.url !== 'string') {
        throw new Error('Stripe checkout URL is missing.');
      }

      window.location.href = data.url;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to start checkout.');
      setLoading(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="setup-deposit-modal" role="presentation">
      <button
        type="button"
        className="setup-deposit-modal__backdrop"
        aria-label="Close setup deposit dialog"
        onClick={onClose}
        disabled={loading}
      />
      <div
        ref={dialogRef}
        className="setup-deposit-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="setup-deposit-modal__header">
          <h2 id={titleId} className="setup-deposit-modal__title">
            Start {planName} setup
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm setup-deposit-modal__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <p className="setup-deposit-modal__note">
          50% deposit now. Remaining 50% due before go-live. Refundable if you cancel before work begins; non-refundable
          once work begins.
        </p>

        <form className="setup-deposit-modal__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="setup-deposit-name">
              Name
            </label>
            <input
              ref={nameInputRef}
              id="setup-deposit-name"
              className="input"
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="setup-deposit-email">
              Email
            </label>
            <input
              id="setup-deposit-email"
              className="input"
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="setup-deposit-shop-name">
              Shop name
            </label>
            <input
              id="setup-deposit-shop-name"
              className="input"
              type="text"
              name="shopName"
              value={shopName}
              onChange={(event) => setShopName(event.target.value)}
              autoComplete="organization"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="setup-deposit-shop-size">
              Shop size
            </label>
            <select
              id="setup-deposit-shop-size"
              className="select"
              name="shopSize"
              value={shopSize}
              onChange={(event) => setShopSize(event.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select shop size</option>
              {SHOP_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="setup-deposit-current-stack">
              Current booking stack
            </label>
            <select
              id="setup-deposit-current-stack"
              className="select"
              name="currentStack"
              value={currentStack}
              onChange={(event) => setCurrentStack(event.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select current stack</option>
              {CURRENT_STACK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="setup-deposit-modal__terms">
            <input
              type="checkbox"
              name="termsAccepted"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              disabled={loading}
              required
            />
            <span>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms
              </a>{' '}
              and understand the deposit starts my setup.
            </span>
          </label>

          <div className="setup-deposit-modal__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? 'Redirecting…' : `Pay ${depositFormatted} deposit`}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>

          {submitError ? (
            <p className="setup-deposit-modal__error" role="alert">
              {submitError}
            </p>
          ) : null}
        </form>
      </div>
    </div>,
    document.body,
  );
}
