import type { Downtime } from "@/lib/downtime";
import { bufferedSpan, type FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import { localDate, startOfDay, toDate } from "@/server/time/temporal";
import { clipIntervals, type Interval, type IntervalSet, mergeIntervals, subtractIntervals } from "@/lib/time/interval";

/** Returns the parts of `range` outside downtime and fixed items (including their buffers), sorted by start. */
export function freeTimeMap(range: Interval, fixedItems: FixedItem[], settings: SchedulerSettings): IntervalSet {
  const busy = fixedItems.map(bufferedSpan);
  return subtractIntervals([range], [...downtimeIntervals(range, settings.downtime, settings.timeZone), ...busy]);
}

export function downtimeIntervals(range: Interval, downtime: Downtime, timeZone: TimeZone): IntervalSet {
  const lastDay = localDate(range.end, timeZone);
  const intervals: Interval[] = [];

  for (
    let day = localDate(range.start, timeZone);
    Temporal.PlainDate.compare(day, lastDay) <= 0;
    day = day.add({ days: 1 })
  ) {
    for (const { startMinute, endMinute } of downtime[day.dayOfWeek - 1]) {
      intervals.push({ start: atLocalTime(day, startMinute, timeZone), end: atLocalTime(day, endMinute, timeZone) });
    }
  }
  return mergeIntervals(clipIntervals(intervals, range));
}

function atLocalTime(day: Temporal.PlainDate, minuteOfDay: number, timeZone: TimeZone): Date {
  if (minuteOfDay === MINUTES_PER_DAY) return startOfDay(day.add({ days: 1 }), timeZone);
  const plainTime = new Temporal.PlainTime(Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  return toDate(day.toZonedDateTime({ timeZone, plainTime }));
}
