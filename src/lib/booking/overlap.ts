export type Interval = { startAt: Date; endAt: Date };

export function hasOverlap(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function hasAnyOverlap(target: Interval, intervals: Interval[]): boolean {
  return intervals.some((item) => hasOverlap(target, item));
}
