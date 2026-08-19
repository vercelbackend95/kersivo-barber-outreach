type ShopEmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ShopEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
}: ShopEmptyStateProps) {
  return (
    <article className="sf-empty" role="status">
      <h2 className="sf-empty-title">{title}</h2>
      <p className="sf-empty-desc">{description}</p>
      {onAction && actionLabel ? (
        <button type="button" className="sf-empty-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : actionHref && actionLabel ? (
        <a className="sf-atc" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}
    </article>
  );
}
