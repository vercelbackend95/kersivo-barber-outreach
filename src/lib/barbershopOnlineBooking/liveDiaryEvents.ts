/**
 * Commands the page script (experience.ts) sends to the live KERSIVO timeline island. No imports,
 * so the page script never pulls the demo fixtures into its bundle.
 */
/**
 * The demo clock each timeline runs on (London minute, today). The hero is mid-morning, so the
 * day has finished, live and coming appointments and the phone offers only later times. The
 * availability example starts before opening, so every appointment is still to come.
 */
export const HERO_DEMO_NOW_MINUTE = 11 * 60 + 50;
export const AVAILABILITY_DEMO_NOW_MINUTE = 8 * 60 + 30;

/** Event the hero phone and the availability controls send to the timeline. */
export const LIVE_DIARY_EVENT = 'bob:diary';

export type LiveDiaryCommand =
  | {
      /** Which timeline on the page: the hero or the availability example. */
      target: 'hero' | 'availability';
      type: 'add';
      id: string;
      barberId: string;
      start: number;
      end: number;
      serviceName: string;
      pricePence: number;
      clientName: string;
      tag: string;
    }
  | { target: 'hero' | 'availability'; type: 'remove'; id: string }
  | { target: 'hero' | 'availability'; type: 'focus'; barberId: string; start: number };

/* Adds and removes are also kept, so a timeline that mounts later (it loads when it scrolls into
   view) still shows bookings made before it was there. */
const history: LiveDiaryCommand[] = [];

export function sendLiveDiary(command: LiveDiaryCommand): void {
  history.push(command);
  window.dispatchEvent(new CustomEvent<LiveDiaryCommand>(LIVE_DIARY_EVENT, { detail: command }));
}

/** Adds still standing for one timeline, oldest first. */
export function liveDiaryBacklog(target: LiveDiaryCommand['target']): Extract<LiveDiaryCommand, { type: 'add' }>[] {
  const adds = new Map<string, Extract<LiveDiaryCommand, { type: 'add' }>>();
  for (const command of history) {
    if (command.target !== target) continue;
    if (command.type === 'add') adds.set(command.id, command);
    else if (command.type === 'remove') adds.delete(command.id);
  }
  return [...adds.values()];
}

/** The last command for one timeline when it was a focus (to replay on a late mount). */
export function liveDiaryPendingFocus(target: LiveDiaryCommand['target']): Extract<LiveDiaryCommand, { type: 'focus' }> | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const command = history[i]!;
    if (command.target !== target) continue;
    return command.type === 'focus' ? command : null;
  }
  return null;
}
