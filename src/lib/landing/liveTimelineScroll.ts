/** Mid-afternoon focus so evening landing visitors still see busy demo slots. */
export const LANDING_TIMELINE_SCROLL_FOCUS = '14:10';

function timeLabelToMinutes(label: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(label.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Pick the HH:mm label closest to `focus` (exact match preferred). */
export function pickClosestTimeLabel(
  labels: readonly string[],
  focus: string = LANDING_TIMELINE_SCROLL_FOCUS,
): string | null {
  const focusMinutes = timeLabelToMinutes(focus);
  if (focusMinutes === null || labels.length === 0) return null;

  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const label of labels) {
    const minutes = timeLabelToMinutes(label);
    if (minutes === null) continue;
    const distance = Math.abs(minutes - focusMinutes);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = label;
    }
  }

  return best;
}
