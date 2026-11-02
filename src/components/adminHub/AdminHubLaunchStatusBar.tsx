import { SETUP_LAUNCH_BAR_OPEN, setupCardAllDone, type SetupCardModel } from '@/lib/adminHub/setupCard';

export function AdminHubLaunchStatusBar(props: {
  card: SetupCardModel;
  onOpenMenu: () => void;
}) {
  const { card, onOpenMenu } = props;
  if (setupCardAllDone(card)) return null;

  const next = card.items.find((item) => item.id === card.nextId) ?? null;

  return (
    <div className="admin-hub-launch-bar" data-testid="admin-hub-launch-bar">
      <p className="admin-hub-launch-bar__status">{card.status}</p>
      {next ? (
        <a className="admin-hub-launch-bar__btn" href={next.href}>
          {next.label}
        </a>
      ) : (
        <button type="button" className="admin-hub-launch-bar__btn" onClick={onOpenMenu}>
          {SETUP_LAUNCH_BAR_OPEN}
        </button>
      )}
    </div>
  );
}
