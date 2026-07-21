import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from '../lucide-react';
import type { ScheduleListBooking } from './AdminBookingsScheduleList';
import { adminFetchJson } from './adminAuth';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';

export const HISTORY_STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW', label: 'No show' },
  { value: 'CANCELLED_BY_CLIENT', label: 'Cancelled by client' },
  { value: 'CANCELLED_BY_SHOP', label: 'Cancelled by shop' },
] as const;

export type HistoryStatusValue = (typeof HISTORY_STATUS_OPTIONS)[number]['value'];

type HistoryBookingStatusSheetProps = {
  booking: ScheduleListBooking | null;
  onClose: () => void;
  onSaved: (bookingId: string, status: HistoryStatusValue) => void | Promise<void>;
  /** When 'barber', only Completed / No-show; when false, sheet won't open for mutations. */
  actionRoleScope?: 'barber' | 'shop';
  canEdit?: boolean;
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

function toHistoryStatus(status: string): HistoryStatusValue | null {
  return HISTORY_STATUS_OPTIONS.some((option) => option.value === status)
    ? (status as HistoryStatusValue)
    : null;
}

function formatSheetDateTime(startAt: string): string {
  const date = new Date(startAt);
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/London',
  }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}

export default function HistoryBookingStatusSheet({
  booking,
  onClose,
  onSaved,
  actionRoleScope = 'shop',
  canEdit = true,
}: HistoryBookingStatusSheetProps) {
  const titleId = useId();
  const optionsId = useId();
  const [mounted, setMounted] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<HistoryStatusValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isMobileChrome = useAdminMobileChromeBreakpoint();
  const reduceMotion = useReducedMotion();

  const statusOptions =
    actionRoleScope === 'barber'
      ? HISTORY_STATUS_OPTIONS.filter((o) => o.value === 'COMPLETED' || o.value === 'NO_SHOW')
      : HISTORY_STATUS_OPTIONS;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSelectedStatus(booking ? toHistoryStatus(booking.status) : null);
    setError('');
    setSaving(false);
  }, [booking]);

  useEffect(() => {
    if (!booking) return undefined;
    if (!canEdit) {
      onClose();
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [booking, onClose, saving, canEdit]);

  if (!mounted || typeof document === 'undefined' || !canEdit) return null;

  const currentStatus = booking ? toHistoryStatus(booking.status) : null;
  const barberName = booking?.barber?.name?.trim() || '—';
  const serviceName = booking?.service?.name?.trim() || '—';
  const isAutoCompleted = booking?.status === 'COMPLETED';
  const canSave =
    Boolean(booking) &&
    selectedStatus !== null &&
    selectedStatus !== currentStatus &&
    !saving;

  const sheetVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : isMobileChrome
      ? {
          initial: { opacity: 0, y: '100%' },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: '100%' },
        }
      : {
          initial: { opacity: 0, scale: 0.98, y: 12 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.98, y: 8 },
        };

  const saveStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!booking || !selectedStatus || !canSave) return;
    setSaving(true);
    setError('');
    try {
      await adminFetchJson(`/api/admin/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
        errorMessage: 'Could not update booking status.',
      });
      await onSaved(booking.id, selectedStatus);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update booking status.');
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {booking ? (
        <motion.div
          key="history-status-sheet"
          className="admin-vtl-bottom-sheet-backdrop admin-history-status-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.16 : 0.22, ease: 'easeOut' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            className="admin-vtl-bottom-sheet admin-history-status-sheet"
            initial={sheetVariants.initial}
            animate={sheetVariants.animate}
            exit={sheetVariants.exit}
            transition={{ duration: reduceMotion ? 0.16 : 0.32, ease: EASE_OUT_EXPO }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-vtl-bottom-sheet-header">
              <h2 id={titleId} className="admin-vtl-bottom-sheet-title">
                Update booking status
              </h2>
              <button
                type="button"
                className="admin-vtl-bottom-sheet-close"
                onClick={onClose}
                disabled={saving}
                aria-label="Close status sheet"
              >
                <X className="admin-vtl-bottom-sheet-close-icon" aria-hidden="true" />
              </button>
            </div>

            <form
              className="admin-vtl-bottom-sheet-content admin-history-status-sheet__content"
              onSubmit={saveStatus}
            >
              <div className="admin-history-status-sheet__booking">
                <strong>{booking.fullName || 'Unnamed client'}</strong>
                <span>
                  {serviceName} · {barberName}
                </span>
                <span>{formatSheetDateTime(booking.startAt)}</span>
              </div>

              {isAutoCompleted ? (
                <p className="admin-history-status-sheet__notice">
                  This booking was automatically marked as completed after the appointment time ended.
                </p>
              ) : null}

              <div
                className="admin-history-status-sheet__options"
                role="radiogroup"
                aria-labelledby={optionsId}
              >
                <p id={optionsId} className="sr-only">
                  Select booking status
                </p>
                {statusOptions.map((option) => {
                  const selected = selectedStatus === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={saving}
                      className={`admin-history-status-sheet__option${selected ? ' is-selected' : ''}`}
                      onClick={() => setSelectedStatus(option.value)}
                    >
                      <span className="admin-history-status-sheet__option-radio" aria-hidden="true" />
                      <span className="admin-history-status-sheet__option-label">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {error ? (
                <p className="admin-history-status-sheet__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn btn--primary admin-history-status-sheet__save"
                disabled={!canSave}
              >
                {saving ? 'Saving…' : 'Save status'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
