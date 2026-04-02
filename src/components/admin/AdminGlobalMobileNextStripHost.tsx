import React, { useEffect, useMemo, useState } from 'react';
import AdminMobileNextAppointmentsLive from './AdminMobileNextAppointmentsLive';
import { useAdminMobileTopExtension } from './AdminLayout';
import { ADMIN_MOBILE_CHROME_MAX_PX } from './useAdminMobileNextAppointmentsChrome';

/**
 * Registers the mobile Next appointments strip in AdminLayout's header extension slot.
 * Lives in `persistentAdminChrome` so it is not unmounted when section navigation shows a skeleton.
 */
export default function AdminGlobalMobileNextStripHost() {
  const setMobileTopExtension = useAdminMobileTopExtension();
  const [isMobileChrome, setIsMobileChrome] = useState(false);
  const stripNode = useMemo(() => <AdminMobileNextAppointmentsLive />, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${ADMIN_MOBILE_CHROME_MAX_PX}px)`);
    const update = () => setIsMobileChrome(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isMobileChrome) {
      setMobileTopExtension(null);
      return undefined;
    }
    setMobileTopExtension(stripNode);
    return () => {
      setMobileTopExtension(null);
    };
  }, [isMobileChrome, setMobileTopExtension, stripNode]);

  return null;
}
