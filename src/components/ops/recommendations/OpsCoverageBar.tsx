type Props = {
  readable: number;
  active: number;
};

export function OpsCoverageBar({ readable, active }: Props) {
  const pct = active > 0 ? Math.min(100, Math.round((readable / active) * 100)) : 0;
  const text = `${readable} of ${active} services`;
  return (
    <div className="ops-coverage">
      <span className="ops-coverage__text">{text}</span>
      <div
        className="ops-coverage__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Readable rails: ${text}`}
      >
        <div className="ops-coverage__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
