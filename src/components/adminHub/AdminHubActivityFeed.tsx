import { useEffect, useState } from 'react';
import { Check, ImagePlus, ListChecks, MessageCircle, TrendingUp } from '@/components/lucide-react';
import { ADMIN_HUB_ACTIVITY_EMPTY, ADMIN_HUB_ACTIVITY_TODAY } from '@/lib/adminHub/copy';
import {
  HUB_ACTIVITY_ADDED,
  HUB_ACTIVITY_KIND_FILE,
  HUB_ACTIVITY_KIND_LOGO,
  HUB_ACTIVITY_KIND_PHOTO,
  HUB_ACTIVITY_KIND_PRICE,
  HUB_ACTIVITY_KIND_TEAM,
} from '@/lib/freePreview/hubCopy';

export type AdminHubActivityKind = 'message' | 'upload' | 'status' | 'change' | 'default';

export type AdminHubActivityRow = {
  id: string;
  label: string;
  kind: AdminHubActivityKind;
  at: string;
  relative: string;
  absolute: string;
};

export type AdminHubActivityGroup = {
  label: string;
  items: AdminHubActivityRow[];
};

function kindLabel(kind: string | undefined): string {
  if (kind === 'LOGO') return HUB_ACTIVITY_KIND_LOGO;
  if (kind === 'SHOP_PHOTO') return HUB_ACTIVITY_KIND_PHOTO;
  if (kind === 'TEAM_PHOTO') return HUB_ACTIVITY_KIND_TEAM;
  if (kind === 'PRICE_LIST') return HUB_ACTIVITY_KIND_PRICE;
  return HUB_ACTIVITY_KIND_FILE;
}

function ActivityIcon({ kind }: { kind: AdminHubActivityKind }) {
  const Icon =
    kind === 'message'
      ? MessageCircle
      : kind === 'upload'
        ? ImagePlus
        : kind === 'change'
          ? ListChecks
          : kind === 'status'
            ? TrendingUp
            : Check;
  return <Icon width={13} height={13} strokeWidth={1.8} aria-hidden="true" />;
}

export function AdminHubActivityFeed(props: { groups: AdminHubActivityGroup[] }) {
  const [groups, setGroups] = useState(props.groups);

  useEffect(() => {
    setGroups(props.groups);
  }, [props.groups]);

  useEffect(() => {
    const onUpload = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; asset?: { id?: string } }>).detail;
      if (!detail?.asset?.id) return;
      const now = new Date();
      const row: AdminHubActivityRow = {
        id: `local-${detail.asset.id}`,
        label: HUB_ACTIVITY_ADDED(1, kindLabel(detail.kind)),
        kind: 'upload',
        at: now.toISOString(),
        relative: 'just now',
        absolute: now.toLocaleString('en-GB', {
          timeZone: 'Europe/London',
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      };
      setGroups((current) => {
        const flat = [row, ...current.flatMap((group) => group.items)].slice(0, 5);
        const next: AdminHubActivityGroup[] = [];
        for (const item of flat) {
          const label = item.id.startsWith('local-') ? ADMIN_HUB_ACTIVITY_TODAY : (current.find((group) => group.items.some((row) => row.id === item.id))?.label ?? ADMIN_HUB_ACTIVITY_TODAY);
          const last = next.at(-1);
          if (last?.label === label) last.items.push(item);
          else next.push({ label, items: [item] });
        }
        return next;
      });
    };
    window.addEventListener('admin-hub:asset-uploaded', onUpload);
    return () => window.removeEventListener('admin-hub:asset-uploaded', onUpload);
  }, []);

  if (!groups.length) {
    return <p className="admin-hub-nowbox__v">{ADMIN_HUB_ACTIVITY_EMPTY}</p>;
  }

  return (
    <div className="admin-hub-feed-wrap">
      {groups.map((group) => (
        <section key={group.label} className="admin-hub-feed-day">
          <h3 className="admin-hub-feed-day__label">{group.label}</h3>
          <ul className="admin-hub-feed">
            {group.items.map((item) => (
              <li key={item.id}>
                <span className={`admin-hub-fdot${item.kind === 'status' ? ' admin-hub-fdot--accent' : ''}`}>
                  <ActivityIcon kind={item.kind} />
                </span>
                <span>{item.label}</span>
                <time dateTime={item.at} title={item.absolute}>
                  {item.relative}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
