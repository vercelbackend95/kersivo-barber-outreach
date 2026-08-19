type ProductAvailabilityBadgeProps = {
  soldOut?: boolean;
};

export default function ProductAvailabilityBadge({ soldOut = false }: ProductAvailabilityBadgeProps) {
  if (!soldOut) return null;
  return <span className="sf-badge sf-badge--sold">Sold out</span>;
}
