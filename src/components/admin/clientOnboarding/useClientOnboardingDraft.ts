import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientOnboardingStatus } from '@prisma/client';
import {
  buildEmptyFieldPrefill,
  draftFromOnboarding,
  readJsonError,
  type ClientOnboardingState,
  type DraftFields,
  type OnboardingAsset,
  type SaveStatus,
} from './types';

export const AUTOSAVE_MS = 700;

type GateError =
  | { kind: 'unauthorized' }
  | { kind: 'unpaid' }
  | { kind: 'forbidden' }
  | { kind: 'server'; message: string }
  | null;

export function useClientOnboardingDraft() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ClientOnboardingState | null>(null);
  const [draft, setDraft] = useState<DraftFields | null>(null);
  const [step, setStep] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [gateError, setGateError] = useState<GateError>(null);
  const [dirty, setDirty] = useState(false);
  const [prefillKind, setPrefillKind] = useState<'none' | 'fields' | 'canonical'>('none');

  const draftRef = useRef<DraftFields | null>(null);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seedAppliedRef = useRef(false);
  const scheduleAutosaveRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const applyPayload = useCallback((payload: ClientOnboardingState) => {
    const nextDraft = draftFromOnboarding(payload.onboarding);
    setState(payload);
    setDraft(nextDraft);
    draftRef.current = nextDraft;
    const restored = Math.min(11, Math.max(0, payload.onboarding.currentStep ?? 0));
    setStep(restored);
    setDirty(false);
    dirtyRef.current = false;
    setSaveStatus('idle');
    setSaveError('');
  }, []);

  const patchDraft = useCallback(
    async (
      partial: Partial<DraftFields>,
      opts?: { markCleanRevision?: number },
    ): Promise<boolean> => {
      const seq = ++seqRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSaveStatus('saving');
      setSaveError('');
      try {
        const response = await fetch('/api/admin/client-onboarding', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
          signal: controller.signal,
        });
        if (seq !== seqRef.current) return false;
        if (response.status === 409) {
          await reloadRef.current();
          return false;
        }
        if (!response.ok) {
          const body = await readJsonError(response);
          setSaveStatus('error');
          setSaveError(body.error || 'Could not save. Please try again.');
          return false;
        }
        const body = (await response.json()) as {
          ok: true;
          onboarding: ClientOnboardingState['onboarding'];
        };
        setState((prev) => (prev ? { ...prev, onboarding: body.onboarding } : prev));

        if (opts?.markCleanRevision != null) {
          if (revisionRef.current === opts.markCleanRevision) {
            setSaveStatus('saved');
            setDirty(false);
            dirtyRef.current = false;
          } else {
            // Newer local edits landed while this request was in flight — keep dirty and retry.
            setDirty(true);
            dirtyRef.current = true;
            setSaveStatus('saving');
            scheduleAutosaveRef.current();
          }
        } else if (!dirtyRef.current) {
          setSaveStatus('saved');
        }
        return true;
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return false;
        if (seq !== seqRef.current) return false;
        setSaveStatus('error');
        setSaveError('Could not save. Please try again.');
        return false;
      }
    },
    [],
  );

  const scheduleAutosave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushSaveRef.current();
    }, AUTOSAVE_MS);
  }, []);

  scheduleAutosaveRef.current = scheduleAutosave;

  const flushSaveRef = useRef(async (): Promise<boolean> => true);

  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current || !draftRef.current) return true;
    const savedRevision = revisionRef.current;
    const { currentStep: _step, ...fields } = draftRef.current;
    return patchDraft(fields, { markCleanRevision: savedRevision });
  }, [patchDraft]);

  flushSaveRef.current = flushSave;

  const maybeSeedPrefill = useCallback(
    async (payload: ClientOnboardingState) => {
      const hasCanonical =
        payload.barbers.some((b) => b.active) ||
        payload.services.some((s) => s.isActive) ||
        payload.openingHours.some((h) => h.active);

      const resolveKind = (seededFields: boolean) => {
        if (seededFields) return 'fields' as const;
        if (hasCanonical) return 'canonical' as const;
        return 'none' as const;
      };

      if (payload.onboarding.status !== ClientOnboardingStatus.DRAFT) {
        setPrefillKind(resolveKind(false));
        return;
      }

      if (seedAppliedRef.current) {
        const alreadyHasContactOrTown = Boolean(
          payload.onboarding.townCity?.trim() ||
            payload.onboarding.primaryContactName?.trim() ||
            payload.onboarding.primaryContactEmail?.trim(),
        );
        setPrefillKind(resolveKind(alreadyHasContactOrTown));
        return;
      }

      seedAppliedRef.current = true;
      const seed = buildEmptyFieldPrefill(payload);
      if (Object.keys(seed).length === 0) {
        setPrefillKind(resolveKind(false));
        return;
      }

      setPrefillKind('fields');
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...seed };
        draftRef.current = next;
        return next;
      });
      setState((prev) =>
        prev ? { ...prev, onboarding: { ...prev.onboarding, ...seed } } : prev,
      );
      revisionRef.current += 1;
      const rev = revisionRef.current;
      setDirty(true);
      dirtyRef.current = true;
      await patchDraft(seed, { markCleanRevision: rev });
    },
    [patchDraft],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setGateError(null);
    try {
      const response = await fetch('/api/admin/client-onboarding', {
        credentials: 'include',
      });
      if (response.status === 401) {
        setGateError({ kind: 'unauthorized' });
        setState(null);
        setDraft(null);
        return;
      }
      if (response.status === 403) {
        const body = await readJsonError(response);
        if (body.code === 'CLIENT_ONBOARDING_REQUIRES_PAID_SUBSCRIPTION') {
          setGateError({ kind: 'unpaid' });
        } else {
          setGateError({ kind: 'forbidden' });
        }
        setState(null);
        setDraft(null);
        return;
      }
      if (!response.ok) {
        const body = await readJsonError(response);
        setGateError({
          kind: 'server',
          message: body.error || 'Could not load your setup details.',
        });
        return;
      }
      const payload = (await response.json()) as ClientOnboardingState;
      applyPayload(payload);
      await maybeSeedPrefill(payload);
    } catch {
      setGateError({
        kind: 'server',
        message: 'Could not load your setup details. Please refresh.',
      });
    } finally {
      setLoading(false);
    }
  }, [applyPayload, maybeSeedPrefill]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateDraft = useCallback(
    (patch: Partial<DraftFields>, opts?: { autosave?: boolean }) => {
      revisionRef.current += 1;
      setDraft((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        draftRef.current = next;
        return next;
      });
      setDirty(true);
      dirtyRef.current = true;
      if (opts?.autosave !== false) scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const goToStep = useCallback(
    async (nextStep: number) => {
      const ok = await flushSave();
      if (!ok && dirtyRef.current) return false;
      const saved = await patchDraft({ currentStep: nextStep });
      if (!saved) return false;
      setStep(nextStep);
      setDraft((prev) => (prev ? { ...prev, currentStep: nextStep } : prev));
      return true;
    },
    [flushSave, patchDraft],
  );

  const upsertAsset = useCallback((asset: OnboardingAsset) => {
    setState((prev) => {
      if (!prev) return prev;
      const without = prev.assets.filter((a) => a.id !== asset.id);
      return { ...prev, assets: [...without, asset] };
    });
  }, []);

  const removeAssetLocal = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, assets: prev.assets.filter((a) => a.id !== id) };
    });
  }, []);

  const mergeCanonical = useCallback(
    (slice: Partial<Pick<ClientOnboardingState, 'barbers' | 'services' | 'openingHours' | 'workspace'>>) => {
      setState((prev) => (prev ? { ...prev, ...slice } : prev));
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return {
    loading,
    state,
    setState,
    draft,
    step,
    setStep,
    saveStatus,
    saveError,
    gateError,
    dirty,
    prefillKind,
    reload,
    updateDraft,
    flushSave,
    goToStep,
    patchDraft,
    upsertAsset,
    removeAssetLocal,
    mergeCanonical,
  };
}
