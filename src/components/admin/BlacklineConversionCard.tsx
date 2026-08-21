import React from 'react';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { OWNER_LAUNCH_HREF } from '@/lib/admin/launchCtaProgress';
import AdminLaunchCtaButton from './AdminLaunchCtaButton';

export default function BlacklineConversionCard() {
  return (
    <AdminLaunchCtaButton
      conversion
      href={OWNER_LAUNCH_HREF}
      ariaLabel="Ready to make it yours? Get Kersivo for my shop. Start with your shop details, £39 per month"
      status="READY TO MAKE IT YOURS?"
      title="Get KERSIVO for my shop"
      supporting="Start with your shop details · £39/month"
      dataTrack={FUNNEL_EVENTS.blackline_admin_create_system_click}
    />
  );
}
