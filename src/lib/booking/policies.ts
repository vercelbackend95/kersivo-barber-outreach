
export function canCancelOrReschedule(startAt: Date, windowHours: number): boolean {
  const diff = startAt.getTime() - Date.now();
  return diff >= windowHours * 60 * 60000;
}
