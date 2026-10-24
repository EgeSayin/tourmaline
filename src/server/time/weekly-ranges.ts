import type { Interval, IntervalSet } from "@/lib/time/interval";
import { clipIntervals, mergeIntervals } from "@/lib/time/interval";
import type { WeeklyRanges } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import { atLocalTime, localDate } from "@/server/time/temporal";

/** The exact times within `range` that `weekly`'s local ranges cover, joined across midnight. */
export function weeklyIntervals(range: Interval, weekly: WeeklyRanges, timeZone: TimeZone): IntervalSet {
  const lastDay = localDate(range.end, timeZone);
  const intervals: Interval[] = [];

  for (
    let day = localDate(range.start, timeZone);
    Temporal.PlainDate.compare(day, lastDay) <= 0;
    day = day.add({ days: 1 })
  ) {
    for (const { startMinute, endMinute } of weekly[day.dayOfWeek - 1]) {
      intervals.push({ start: atLocalTime(day, startMinute, timeZone), end: atLocalTime(day, endMinute, timeZone) });
    }
  }
  return mergeIntervals(clipIntervals(intervals, range));
}
