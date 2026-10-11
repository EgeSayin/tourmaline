import { addMinutes } from "@/lib/time/duration";
import type { FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import type { DailyWindow } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";
import { localDate, toDate } from "@/server/time/temporal";
import { clipIntervals, type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";

/** Returns the parts of `range` outside downtime and fixed items (including their buffers), sorted by start. */
export function freeTimeMap(range: Interval, fixedItems: FixedItem[], settings: SchedulerSettings): IntervalSet {
  const busy = fixedItems.map((item) => ({
    start: addMinutes(item.start, -item.bufferBeforeMin),
    end: addMinutes(item.end, item.bufferAfterMin),
  }));
  return subtractIntervals([range], [...dailyIntervals(range, settings.downtime, settings.timeZone), ...busy]);
}

export function dailyIntervals(range: Interval, window: DailyWindow, timeZone: TimeZone): Interval[] {
  const wrapsMidnight = window.endMinute < window.startMinute;

  // A window that wraps midnight may have started the evening before the range.
  let day = localDate(range.start, timeZone).subtract({ days: wrapsMidnight ? 1 : 0 });
  const lastDay = localDate(range.end, timeZone);
  const windows: Interval[] = [];

  for (; Temporal.PlainDate.compare(day, lastDay) <= 0; day = day.add({ days: 1 })) {
    windows.push({
      start: atLocalTime(day, window.startMinute, timeZone),
      end: atLocalTime(wrapsMidnight ? day.add({ days: 1 }) : day, window.endMinute, timeZone),
    });
  }
  return clipIntervals(windows, range);
}

function atLocalTime(day: Temporal.PlainDate, minuteOfDay: number, timeZone: TimeZone): Date {
  const plainTime = new Temporal.PlainTime(Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  return toDate(day.toZonedDateTime({ timeZone, plainTime }));
}
