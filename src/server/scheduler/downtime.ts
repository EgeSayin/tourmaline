import "server-only";
import type { SchedulerSettings } from "@/lib/settings";
import type { Interval } from "./intervals";

/** Returns the downtime within `range` as exact times, sorted by start. */
export function downtimeIntervals(range: Interval, settings: SchedulerSettings): Interval[] {
  const { timeZone, downtime } = settings;
  const wrapsMidnight = downtime.endMinute < downtime.startMinute;

  // A window that wraps midnight may have started the evening before the range.
  let day = toLocalDate(range.start, timeZone).subtract({ days: wrapsMidnight ? 1 : 0 });
  const lastDay = toLocalDate(range.end, timeZone);
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

function toLocalDate(date: Date, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
}

function atLocalTime(day: Temporal.PlainDate, minuteOfDay: number, timeZone: string): Date {
  const plainTime = new Temporal.PlainTime(Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  return new Date(day.toZonedDateTime({ timeZone, plainTime }).epochMilliseconds);
}
