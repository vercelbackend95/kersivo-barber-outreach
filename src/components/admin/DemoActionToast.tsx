import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_DEMO_BLOCKED_EVENT } from './adminAuth';
import { DEMO_ACTION_BLOCKED_MESSAGE } from '@/lib/admin/demoConfig';

export default function DemoActionToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const show = () => {
      setMessage(DEMO_ACTION_BLOCKED_MESSAGE);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setMessage(null);
        timeoutRef.current = null;
      }, 4000);
    };

    window.addEventListener(ADMIN_DEMO_BLOCKED_EVENT, show);
    return () => {
      window.removeEventListener(ADMIN_DEMO_BLOCKED_EVENT, show);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!message || typeof document === 'undefined') return null;

  return createPortal(
    <div className="admin-demo-toast" role="status" aria-live="polite">
      {message}
    </div>,
    document.body,
  );
}
