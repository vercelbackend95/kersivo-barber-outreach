import { useState } from 'react';
import {
  HUB_CHANGES_DRAFT,
  HUB_CHANGES_FAILED,
  HUB_CHANGES_NO_DRAFTS,
  HUB_CHANGES_SENT,
} from '@/lib/freePreview/hubCopy';
import { HUB_CHANGE_PAGES, type HubChangePublic } from '@/lib/freePreview/hubChanges.shared';
import { hubApiRoot } from '@/lib/adminHub/links';

export type HubChangeDraftForm = {
  id?: string;
  page: (typeof HUB_CHANGE_PAGES)[number];
  body: string;
  attachmentId: string | null;
};

export const emptyHubChangeDraft = (page: HubChangeDraftForm['page'] = 'HOME'): HubChangeDraftForm => ({
  page,
  body: '',
  attachmentId: null,
});

export type HubChangesModel = {
  token: string;
  apiBase?: string;
  initialItems: HubChangePublic[];
  includedChangeRounds: number;
  changeRoundsUsed: number;
  canDraft: boolean;
  canSend: boolean;
  initialPage?: HubChangeDraftForm['page'];
  startComposer?: boolean;
};

export function useHubChanges(props: HubChangesModel) {
  const apiRoot = hubApiRoot(props);
  const [items, setItems] = useState(props.initialItems);
  const [used, setUsed] = useState(props.changeRoundsUsed);
  const [canSend, setCanSend] = useState(props.canSend);
  const [composer, setComposer] = useState<HubChangeDraftForm | null>(
    props.startComposer ? emptyHubChangeDraft(props.initialPage) : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const drafts = items.filter((item) => item.status === 'DRAFT');
  const sendBlocked = used >= props.includedChangeRounds;

  async function saveDraft() {
    if (!composer || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = composer.id
        ? `${apiRoot}/changes/${encodeURIComponent(composer.id)}`
        : `${apiRoot}/changes`;
      const response = await fetch(url, {
        method: composer.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composer),
      });
      const payload = (await response.json()) as { ok?: boolean; item?: HubChangePublic; error?: string };
      if (!response.ok || !payload.ok || !payload.item) throw new Error(payload.error || HUB_CHANGES_FAILED);
      setItems((current) => {
        const next = current.filter((row) => row.id !== payload.item!.id);
        return [...next, payload.item!].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
      setComposer(null);
      setToast(HUB_CHANGES_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_CHANGES_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiRoot}/changes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || HUB_CHANGES_FAILED);
      setItems((current) => current.filter((row) => row.id !== id));
      if (composer?.id === id) setComposer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_CHANGES_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (busy || sendBlocked) return;
    if (drafts.length === 0) {
      setError(HUB_CHANGES_NO_DRAFTS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiRoot}/changes/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        items?: HubChangePublic[];
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.items) throw new Error(payload.error || HUB_CHANGES_FAILED);
      setItems(payload.items);
      setUsed((value) => value + 1);
      setCanSend(false);
      setToast(HUB_CHANGES_SENT);
    } catch (err) {
      setError(err instanceof Error ? err.message : HUB_CHANGES_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return {
    items,
    drafts,
    used,
    canSend,
    composer,
    setComposer,
    busy,
    error,
    setError,
    toast,
    sendBlocked,
    saveDraft,
    removeDraft,
    send,
    openComposer: (page?: HubChangeDraftForm['page']) => setComposer(emptyHubChangeDraft(page ?? props.initialPage)),
    closeComposer: () => setComposer(null),
    editItem: (item: HubChangePublic) =>
      setComposer({
        id: item.id,
        page: item.page,
        body: item.body,
        attachmentId: item.attachmentId,
      }),
  };
}
