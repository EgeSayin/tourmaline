import type { TimeZone } from "@/lib/time/time-zone";

const formatters = new Map<string, Intl.DateTimeFormat>();

/** An `en-US` formatter with `options`, made once and reused: creating one is slow. */
export function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let cached = formatters.get(key);
  if (!cached) formatters.set(key, (cached = new Intl.DateTimeFormat("en-US", options)));
  return cached;
}

const time = (timeZone: TimeZone) => formatter({ timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = (timeZone: TimeZone) => formatter({ timeZone, weekday: "short", month: "short", day: "numeric" });
/** A `YYYY-MM-DD` local date as a `Date` at noon UTC, so formatting it in UTC shows that date. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`);

export function formatTimeRange(start: Date, end: Date, timeZone: TimeZone): string {
  return `${time(timeZone).format(start)}–${time(timeZone).format(end)}`;
}

/** Short weekday names in ISO order, Monday first. */
export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** A `YYYY-MM-DD` local date's weekday, e.g. "Mon". */
export function formatLocalWeekday(date: string): string {
  return WEEKDAY_NAMES[(noon(date).getUTCDay() + 6) % 7];
}

/** A `YYYY-MM-DD` local date with its weekday, e.g. "Wed, Oct 7". */
export function formatLocalDate(date: string): string {
  return day("UTC").format(noon(date));
}

/** Two `YYYY-MM-DD` local dates as a range, e.g. "Oct 5 – 11, 2026". */
export function formatLocalDateRange(first: string, last: string): string {
  return formatter({ timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).formatRange(
    noon(first),
    noon(last),
  );
}

/** Its local weekday, date and 24-hour time, e.g. "Wed, Oct 7, 21:00", joined by hand: Safari joins them with "at". */
export function formatDateTime(date: Date, timeZone: TimeZone): string {
  return `${day(timeZone).format(date)}, ${time(timeZone).format(date)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
