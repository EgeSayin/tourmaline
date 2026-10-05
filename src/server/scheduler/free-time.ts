import "server-only";
import { addMinutes } from "@/lib/time/duration";
import type { FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";
import { localDate, toDate } from "@/server/time/temporal";
import { type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";

/** Returns the parts of `range` outside downtime and fixed items (including their buffers), sorted by start. */
export function freeTimeMap(range: Interval, fixedItems: FixedItem[], settings: SchedulerSettings): IntervalSet {
  const busy = fixedItems.map((item) => ({
    start: addMinutes(item.start, -item.bufferBeforeMin),
    end: addMinutes(item.end, item.bufferAfterMin),
  }));
  return subtractIntervals([range], [...downtimeIntervals(range, settings), ...busy]);
}

/** Returns the downtime within `range` as exact times, sorted by start. */
export function downtimeIntervals(range: Interval, settings: SchedulerSettings): Interval[] {
  const { timeZone, downtime } = settings;
  const wrapsMidnight = downtime.endMinute < downtime.startMinute;

  // A window that wraps midnight may have started the evening before the range.
  let day = localDate(range.start, timeZone).subtract({ days: wrapsMidnight ? 1 : 0 });
  const lastDay = localDate(range.end, timeZone);
  const result: Interval[] = [];

  for (; Temporal.PlainDate.compare(day, lastDay) <= 0; day = day.add({ days: 1 })) {
    const start = atLocalTime(day, downtime.startMinute, timeZone);
    const end = atLocalTime(wrapsMidnight ? day.add({ days: 1 }) : day, downtime.endMinute, timeZone);
    const clipped = {
      start: start > range.start ? start : range.start,
      end: end < range.end ? end : range.end,
    };
    if (clipped.start < clipped.end) result.push(clipped);
  }
  return result;
}

function atLocalTime(day: Temporal.PlainDate, minuteOfDay: number, timeZone: TimeZone): Date {
  const plainTime = new Temporal.PlainTime(Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  return toDate(day.toZonedDateTime({ timeZone, plainTime }));
}
