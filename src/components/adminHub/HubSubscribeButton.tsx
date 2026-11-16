import { lazy, Suspense, useState, type ReactNode } from 'react';
import { PREVIEW_HUB_PATHS } from '@/lib/adminHub/previewHubPaths';
import type { SetupSubscribe } from '@/lib/adminHub/setupCard';

// The checkout dialog (domain search, Terms) loads on the first click only: this button sits in the admin layout.
const CheckoutDialog = lazy(() => import('@/components/freePreview/PreviewTopBar'));

/**
 * Opens the Full KERSIVO checkout from the hub (the setup card, the setup tour's finale): the same dialog and
 * POST /api/admin-hub/checkout as "Launch this website" on the Overview.
 */
export function HubSubscribeButton(props: {
  subscribe: SetupSubscribe;
  className: string;
  children: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const { subscribe } = props;
  return (
    <>
      <button
        type="button"
        className={props.className}
        data-testid={props.testId}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {props.children}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <CheckoutDialog
            chrome="dialog"
            early={subscribe.early}
            onDialogClose={() => setOpen(false)}
            token=""
            apiBase="/api/admin-hub"
            shopName={subscribe.shopName}
            townCity={subscribe.townCity}
            firstName={subscribe.firstName}
            checkoutEmail={subscribe.checkoutEmail}
            hasOwnDomain={subscribe.hasOwnDomain}
            existingWebsiteHost={subscribe.existingWebsiteHost}
            isOperator={false}
            converted={false}
            activeView="website"
            websiteHref={PREVIEW_HUB_PATHS.website}
            bookingHref={PREVIEW_HUB_PATHS.website}
          />
        </Suspense>
      ) : null}
    </>
  );
}
