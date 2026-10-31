import { ArrowRight, Check } from '@/components/lucide-react';
import { SETUP_FROM_LINKS_TAG, SETUP_OPTIONAL_TAG, type SetupItem } from '@/lib/adminHub/setupCard';
import type { AdminHubAppBodyProps } from './types';
import { AppStatus } from './AppStatus';

function Row({ item }: { item: SetupItem }) {
  return (
    <li>
      <a className={`admin-hub-setup-app__row${item.done ? ' is-done' : ''}`} href={item.href}>
        <span className="admin-hub-setup-app__mark" aria-hidden="true">
          {item.done ? <Check width={12} height={12} strokeWidth={3} /> : null}
        </span>
        <span>{item.label}</span>
        {item.fromLinks && !item.done ? <span className="admin-hub-setup-app__tag">{SETUP_FROM_LINKS_TAG}</span> : null}
        {item.optional && !item.done && !item.fromLinks ? (
          <span className="admin-hub-setup-app__tag">{SETUP_OPTIONAL_TAG}</span>
        ) : null}
        <span className="admin-hub-setup-app__go" aria-hidden="true">
          <ArrowRight width={14} height={14} />
        </span>
      </a>
    </li>
  );
}

export default function SetupApp({ ctx }: AdminHubAppBodyProps) {
  if (!ctx.setupItems.length) {
    return <AppStatus state="empty" empty="Nothing to set up here." />;
  }
  return (
    <AppStatus state="ready">
      <ul className="admin-hub-setup-app">
        {ctx.setupItems.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </AppStatus>
  );
}
