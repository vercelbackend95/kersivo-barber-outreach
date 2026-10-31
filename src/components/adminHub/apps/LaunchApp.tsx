import HubLaunchChecklist from '@/components/previewHub/HubLaunchChecklist';
import { ADMIN_HUB_LAUNCH_READONLY } from '@/lib/adminHub/copy';
import { SETUP_LAUNCH_SIGN_IN, SETUP_OPTIONAL_TAG, type SetupPhase2ItemId } from '@/lib/adminHub/setupCard';
import type { AdminHubAppBodyProps } from './types';
import { AppStatus } from './AppStatus';

const LABELS: Record<SetupPhase2ItemId, string> = {
  business: 'Business details',
  domain: 'Domain',
  payments: 'Payments',
  approve: 'Approve your website',
};

export default function LaunchApp({
  ctx,
  item,
}: AdminHubAppBodyProps & { item: SetupPhase2ItemId }) {
  if (ctx.canEditLaunch) {
    return (
      <HubLaunchChecklist
        initialItem={item}
        embedded
        websiteHref={ctx.websiteHref}
        bookingHref={ctx.bookingHref}
      />
    );
  }

  const flags = ctx.launch;
  const rows: Array<{ id: typeof item; done: boolean; optional: boolean }> = [
    { id: 'business', done: Boolean(flags?.businessDone), optional: false },
    { id: 'domain', done: Boolean(flags?.domainDone), optional: false },
    { id: 'payments', done: Boolean(flags?.paymentsDone), optional: true },
    { id: 'approve', done: Boolean(flags?.approveDone), optional: false },
  ];

  return (
    <AppStatus state="ready">
      <p className="hub-card__body">{ctx.viewer === 'ops' ? ADMIN_HUB_LAUNCH_READONLY : SETUP_LAUNCH_SIGN_IN}</p>
      <ul className="admin-hub-setup-app">
        {rows.map((row) => (
          <li key={row.id}>
            <span className={`admin-hub-setup-app__row${row.done ? ' is-done' : ''}${row.id === item ? ' is-current' : ''}`}>
              <span>{LABELS[row.id]}</span>
              {row.optional ? <span className="admin-hub-setup-app__tag">{SETUP_OPTIONAL_TAG}</span> : null}
              <span>{row.done ? 'Done' : 'To do'}</span>
            </span>
          </li>
        ))}
      </ul>
    </AppStatus>
  );
}

export function BusinessApp(props: AdminHubAppBodyProps) {
  return <LaunchApp {...props} item="business" />;
}
export function DomainApp(props: AdminHubAppBodyProps) {
  return <LaunchApp {...props} item="domain" />;
}
export function PaymentsApp(props: AdminHubAppBodyProps) {
  return <LaunchApp {...props} item="payments" />;
}
export function ApproveApp(props: AdminHubAppBodyProps) {
  return <LaunchApp {...props} item="approve" />;
}
