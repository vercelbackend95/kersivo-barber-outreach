export function OpsAccessDenied() {
  return (
    <div className="ops-gate">
      <p className="ops-gate__brand">KERSIVO Ops</p>
      <h1 className="ops-gate__title">Access denied</h1>
      <p className="ops-gate__body">
        You are signed in, but this account cannot open the Smart Retail Control Room.
      </p>
    </div>
  );
}

export function OpsAccessUnconfigured() {
  return (
    <div className="ops-gate">
      <p className="ops-gate__brand">KERSIVO Ops</p>
      <h1 className="ops-gate__title">Configuration unavailable</h1>
      <p className="ops-gate__body">
        Operator access is not configured for this environment. Contact platform engineering.
      </p>
    </div>
  );
}
