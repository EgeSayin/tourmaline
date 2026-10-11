import type { FocusCaps } from "@/lib/settings";
import { minutesBetween } from "@/lib/time/duration";
import { clipIntervals, type Interval, mergeIntervals } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { localDate, toDate } from "@/server/time/temporal";

/** A local day with its focus cap and the minutes already filled. */
export interface FocusDay extends Interval {
  date: string;
  capMin: number | null;
  usedMin: number;
}

/**
 * The whole local days overlapping `range`, in order, each with its cap from `focusCaps` and the minutes of it that
 * `busy` covers, overlaps counted once.
 */
export function focusDays(range: Interval, busy: Interval[], focusCaps: FocusCaps, timeZone: TimeZone): FocusDay[] {
  const days: FocusDay[] = [];
  if (range.end <= range.start) return days;
  const merged = mergeIntervals(busy);
  for (let day = localDate(range.start, timeZone); ; day = day.add({ days: 1 })) {
    const start = toDate(day.toZonedDateTime(timeZone));
    if (start >= range.end) break;
    const interval = { start, end: toDate(day.add({ days: 1 }).toZonedDateTime(timeZone)) };
    days.push({
      ...interval,
      date: day.toString(),
      capMin: focusCaps[day.dayOfWeek - 1],
      usedMin: minutesWithin(merged, interval),
    });
  }
  return days;
}

/** `days` with `blocks`, which don't overlap what the days already count, filled in too. */
export function fill(days: FocusDay[], blocks: Interval[]): FocusDay[] {
  return days.map((day) => ({ ...day, usedMin: day.usedMin + minutesWithin(blocks, day) }));
}

/** The days among `days` already filled up to their cap. */
export function full(days: FocusDay[]): FocusDay[] {
  return days.filter((day) => day.capMin !== null && day.usedMin >= day.capMin);
}

/** The days among `days` that `blocks` fill some of and would fill past their cap. */
export function overCap(days: FocusDay[], blocks: Interval[]): FocusDay[] {
  return days.filter((day) => {
    const added = minutesWithin(blocks, day);
    return day.capMin !== null && added > 0 && day.usedMin + added > day.capMin;
  });
}

function minutesWithin(intervals: readonly Interval[], window: Interval): number {
  return clipIntervals(intervals, window).reduce((sum, part) => sum + minutesBetween(part.start, part.end), 0);
}
