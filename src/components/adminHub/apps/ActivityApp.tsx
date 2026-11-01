import { HUB_ACTIVITY_EMPTY } from '@/lib/freePreview/hubCopy';
import type { AdminHubAppBodyProps } from './types';
import { AppStatus } from './AppStatus';

export default function ActivityApp({ ctx }: AdminHubAppBodyProps) {
  if (!ctx.activity.length) {
    return <AppStatus state="empty" empty={HUB_ACTIVITY_EMPTY} />;
  }
  return (
    <AppStatus state="ready">
      <ol className="admin-hub-activity">
        {ctx.activity.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <time dateTime={item.at} title={item.absolute}>
              {item.relative}
            </time>
          </li>
        ))}
      </ol>
    </AppStatus>
  );
}
