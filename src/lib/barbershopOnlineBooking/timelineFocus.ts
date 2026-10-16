/**
 * Where a client start time sits on the real admin `TodayTimeline`.
 *
 * The timeline lists equal-height rows: every half hour, plus a row for any booking that starts
 * off the half hour. Rows are ordered by time but not spaced by it, so a time is placed from the
 * rendered rows themselves: on its own row when one exists, otherwise between the rows before
 * and after it in proportion to the minutes (12:15 lands halfway between the 12:00 and 12:30
 * rows). When the earlier row is expanded, the span starts below its booking cards.
 */

export type TimelineRowAnchor = {
  minute: number;
  /** Vertical centre of the row line, in scroll-content pixels. */
  center: number;
  /** Bottom of the row including any expanded booking cards, in scroll-content pixels. */
  bottom: number;
  expanded: boolean;
};

export function locateTimelineMinute(anchors: readonly TimelineRowAnchor[], minute: number): number | null {
  if (anchors.length === 0) return null;
  const rows = [...anchors].sort((a, b) => a.minute - b.minute);
  const exact = rows.find((row) => row.minute === minute);
  if (exact) return exact.center;

  const before = rows.filter((row) => row.minute < minute).at(-1);
  const after = rows.find((row) => row.minute > minute);
  if (!before || !after) return null;

  const from = before.expanded ? before.bottom : before.center;
  const fraction = (minute - before.minute) / (after.minute - before.minute);
  return from + (after.center - from) * fraction;
}
