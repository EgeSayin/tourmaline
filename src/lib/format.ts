import type { TimeZone } from "./time-zone";

export function formatTimeRange(start: Date, end: Date, timeZone: TimeZone): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${time.format(start)}–${time.format(end)}`;
}

/** Formats a `YYYY-MM-DD` local date as its weekday, e.g. "Mon". */
export function formatLocalWeekday(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`));
}

/** Formats a `YYYY-MM-DD` local date with its weekday, e.g. "Wed, Oct 7". */
export function formatLocalDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/** Formats two `YYYY-MM-DD` local dates as a range, e.g. "Oct 5 – 11, 2026". */
export function formatLocalDateRange(first: string, last: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatRange(new Date(`${first}T12:00:00Z`), new Date(`${last}T12:00:00Z`));
}

export function formatDateTime(date: Date, timeZone: TimeZone): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
