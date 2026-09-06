type Props = {
  shopId: string;
};

export function OpsTechnicalFacts({ shopId }: Props) {
  return (
    <details className="ops-detail-tech ops-detail-tech--footer">
      <summary>Technical identifiers</summary>
      <p className="ops-table__muted">Internal shop reference: {shopId}</p>
    </details>
  );
}
