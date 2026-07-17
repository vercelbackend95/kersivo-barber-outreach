import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAdminMobileChromeBreakpoint } from './useAdminMobileNextAppointmentsChrome';

type AdminWizardSheetLayerProps = {
  open: boolean;
  onDismiss: () => void;
  ariaLabelledBy: string;
  /** Host-specific layer classes, e.g. "admin-service-sheet-layer". */
  className?: string;
  children: React.ReactNode;
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Portaled, animated container for the Add Barber / Service / Product wizards.
 * Rendering into document.body escapes the `isolation: isolate` stacking context of
 * .admin-main-content, so the layer can cover the fixed mobile admin header.
 */
export default function AdminWizardSheetLayer({
  open,
  onDismiss,
  ariaLabelledBy,
  className,
  children
}: AdminWizardSheetLayerProps) {
  const [mounted, setMounted] = useState(false);
  const isMobileChrome = useAdminMobileChromeBreakpoint();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const sheetVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      }
    : isMobileChrome
      ? {
          initial: { opacity: 0, y: '12%' },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: '8%' }
        }
      : {
          initial: { opacity: 0, scale: 0.98 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.98 }
        };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`admin-barber-sheet-layer admin-wizard-sheet-layer${className ? ` ${className}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.16 : 0.24, ease: 'easeOut' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onDismiss();
          }}
        >
          <motion.div
            className="admin-wizard-sheet-layer__inner"
            initial={sheetVariants.initial}
            animate={sheetVariants.animate}
            exit={sheetVariants.exit}
            transition={{ duration: reduceMotion ? 0.16 : 0.3, ease: EASE_OUT_EXPO }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onDismiss();
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
