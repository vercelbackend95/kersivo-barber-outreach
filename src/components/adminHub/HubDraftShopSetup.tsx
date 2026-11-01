import { useState } from 'react';
import {
  ADMIN_HUB_APP_ERROR,
  ADMIN_HUB_DRAFT_SHOP_BODY,
  ADMIN_HUB_DRAFT_SHOP_BUTTON,
  ADMIN_HUB_DRAFT_SHOP_TITLE,
} from '@/lib/adminHub/copy';
import { ADMIN_HUB_API_BASE } from '@/lib/adminHub/links';

export function HubDraftShopSetup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setupShop() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${ADMIN_HUB_API_BASE}/draft-shop`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as
        | { shopId?: string; error?: string }
        | null;
      if (!response.ok || !payload?.shopId) {
        setError(payload?.error || ADMIN_HUB_APP_ERROR);
        return;
      }
      window.location.reload();
    } catch {
      setError(ADMIN_HUB_APP_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-hub-locked" data-testid="admin-hub-draft-shop-setup">
      <header className="admin-hub-head">
        <div>
          <h1>{ADMIN_HUB_DRAFT_SHOP_TITLE}</h1>
          <p className="admin-hub-head__sub">{ADMIN_HUB_DRAFT_SHOP_BODY}</p>
        </div>
      </header>
      <div className="admin-hub-tile admin-hub-calm">
        {error ? (
          <p className="admin-inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void setupShop()}
          disabled={busy}
        >
          {ADMIN_HUB_DRAFT_SHOP_BUTTON}
        </button>
      </div>
    </section>
  );
}
