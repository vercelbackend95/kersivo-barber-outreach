import React from 'react';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { OWNER_LAUNCH_HREF } from '@/lib/admin/launchCtaProgress';
import AdminLaunchCtaButton from './AdminLaunchCtaButton';

export default function BlacklineConversionCard() {
  return (
    <AdminLaunchCtaButton
      conversion
      href={OWNER_LAUNCH_HREF}
      ariaLabel="Launch my barbershop. Review setup and choose your plan"
      status="YOUR SHOP IS READY"
      title="Launch my barbershop"
      supporting="Review setup & choose your plan"
      dataTrack={FUNNEL_EVENTS.blackline_admin_create_system_click}
    />
  );
}
