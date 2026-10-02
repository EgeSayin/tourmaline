import type { TimeZone } from "./time-zone";

export interface LocalDateTime {
  /** `YYYY-MM-DD` */
  date: string;
  minuteOfDay: number;
}

const formatters = new Map<TimeZone, Intl.DateTimeFormat>();

export function toLocal(date: Date, timeZone: TimeZone): LocalDateTime {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Local dates (`YYYY-MM-DD`) that overlap `range`, in order. */
export function localDatesInRange(range: { start: Date; end: Date }, timeZone: TimeZone): string[] {
  const dates = new Set<string>();
  for (let t = range.start.getTime(); t < range.end.getTime(); t += 60 * 60_000) {
    dates.add(toLocal(new Date(t), timeZone).date);
  }
  return [...dates];
}
