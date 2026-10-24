import { type ClockFormat, formatTimeOfDay, formatTimeOfDayRange } from "@/lib/time/clock";
import { toLocal } from "@/lib/time/local-time";
import type { TimeZone } from "@/lib/time/time-zone";

const formatters = new Map<string, Intl.DateTimeFormat>();

/** An `en-US` formatter with `options`, made once and reused: creating one is slow. */
export function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let cached = formatters.get(key);
  if (!cached) formatters.set(key, (cached = new Intl.DateTimeFormat("en-US", options)));
  return cached;
}

const day = (timeZone: TimeZone) => formatter({ timeZone, weekday: "short", month: "short", day: "numeric" });
/** A `YYYY-MM-DD` local date as a `Date` at noon UTC, so formatting it in UTC shows that date. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`);

export function formatTimeRange(start: Date, end: Date, timeZone: TimeZone, clock: ClockFormat): string {
  return formatTimeOfDayRange(toLocal(start, timeZone).minuteOfDay, toLocal(end, timeZone).minuteOfDay, clock);
}

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 0 for Monday up to 6 for Sunday. */
export function localWeekdayIndex(date: string): number {
  return (noon(date).getUTCDay() + 6) % 7;
}

export function formatLocalWeekday(date: string): string {
  return WEEKDAY_NAMES[localWeekdayIndex(date)];
}

export function formatLocalDate(date: string): string {
  return day("UTC").format(noon(date));
}

export function formatLocalDateRange(first: string, last: string): string {
  return formatter({ timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).formatRange(
    noon(first),
    noon(last),
  );
}

/** Its local weekday, date and time, e.g. "Wed, Oct 7, 21:00", joined by hand: Safari joins them with "at". */
export function formatDateTime(date: Date, timeZone: TimeZone, clock: ClockFormat): string {
  return `${day(timeZone).format(date)}, ${formatTimeOfDay(toLocal(date, timeZone).minuteOfDay, clock)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
