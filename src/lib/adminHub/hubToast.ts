/**
 * One polite toast for the hub, shown by AppHost even after the app that raised it has closed
 * (e.g. the Colours app saving a draft on close). Client-safe.
 */
import { useSyncExternalStore } from 'react';

export const HUB_TOAST_MS = 4000;

let message = '';
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showHubToast(next: string): void {
  message = next;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    message = '';
    emit();
  }, HUB_TOAST_MS);
  emit();
}

export function getHubToast(): string {
  return message;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHubToast(): string {
  return useSyncExternalStore(subscribe, getHubToast, () => '');
}
