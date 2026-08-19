type ShopEmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function ShopEmptyState({ title, description, actionHref, actionLabel }: ShopEmptyStateProps) {
  return (
    <article className="sf-empty" role="status">
      <h2 className="sf-empty-title">{title}</h2>
      <p className="sf-empty-desc">{description}</p>
      {actionHref && actionLabel ? (
        <a className="sf-atc" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}
    </article>
  );
}
