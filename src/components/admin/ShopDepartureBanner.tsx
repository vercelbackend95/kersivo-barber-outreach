import React, { useEffect, useState } from 'react';
import { shopDepartureWindDownMessage } from '@/lib/shop/shopDepartureCopy';

type DepartureState = { status: 'WINDING_DOWN' | 'RETENTION'; futureAppointments: number };

/** Dashboard-wide notice while a shop is leaving KERSIVO. Renders nothing otherwise. */
export default function ShopDepartureBanner() {
  const [departure, setDeparture] = useState<DepartureState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/departure', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = (await res.json()) as { departure?: DepartureState | null };
        if (!cancelled && data?.departure) setDeparture(data.departure);
      } catch {
        // No banner when the departure state cannot be loaded.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!departure) return null;

  return (
    <div className="admin-inline-error" role="status" data-testid="shop-departure-banner">
      {departure.status === 'WINDING_DOWN'
        ? shopDepartureWindDownMessage(departure.futureAppointments)
        : 'KERSIVO has closed for this shop. New online bookings are off.'}
    </div>
  );
}
