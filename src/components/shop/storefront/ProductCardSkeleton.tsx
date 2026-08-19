export default function ProductCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="sf-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="sf-skeleton-card">
          <div className="sf-skeleton-media" />
          <div className="sf-skeleton-line sf-skeleton-line--wide" />
          <div className="sf-skeleton-line" />
        </li>
      ))}
    </ul>
  );
}
