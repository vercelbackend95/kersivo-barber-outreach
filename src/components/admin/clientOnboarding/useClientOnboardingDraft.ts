import { useCallback, useEffect, useRef, useState } from 'react';
import {
  draftFromOnboarding,
  readJsonError,
  type ClientOnboardingState,
  type DraftFields,
  type SaveStatus,
} from './types';

const AUTOSAVE_MS = 700;

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

  const draftRef = useRef<DraftFields | null>(null);
  const dirtyRef = useRef(false);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    } catch {
      setGateError({
        kind: 'server',
        message: 'Could not load your setup details. Please refresh.',
      });
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patchDraft = useCallback(async (partial: Partial<DraftFields>) => {
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
        await reload();
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
      setSaveStatus('saved');
      setDirty(false);
      dirtyRef.current = false;
      return true;
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return false;
      if (seq !== seqRef.current) return false;
      setSaveStatus('error');
      setSaveError('Could not save. Please try again.');
      return false;
    }
  }, [reload]);

  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current || !draftRef.current) return true;
    const { currentStep: _step, ...fields } = draftRef.current;
    return patchDraft(fields);
  }, [patchDraft]);

  const scheduleAutosave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_MS);
  }, [flushSave]);

  const updateDraft = useCallback(
    (patch: Partial<DraftFields>, opts?: { autosave?: boolean }) => {
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
    reload,
    updateDraft,
    flushSave,
    goToStep,
    patchDraft,
  };
}
