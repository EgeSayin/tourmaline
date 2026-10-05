import "server-only";
import type { TimeZone } from "@/lib/time/time-zone";
import type { Interval } from "@/lib/time/interval";
import { localDate, toDate } from "@/server/time/temporal";

/** Consecutive local days. */
export interface Days {
  /** `YYYY-MM-DD`, in order. */
  dates: string[];
  /** From the first day's midnight to the midnight after the last, local time. */
  range: Interval;
}

/** The Monday-to-Sunday week, in local time, that contains `time`. */
export function weekContaining(time: Date, timeZone: TimeZone): Days {
  return weekOf(localDate(time, timeZone), timeZone);
}

/** Days shown at once on phones. */
export const PHONE_DAY_COUNT = 3;

const startOfDay = (day: Temporal.PlainDate, timeZone: TimeZone) => toDate(day.toZonedDateTime(timeZone));

/** The Monday-to-Sunday week, in local time, that contains `date`. */
export function weekOf(date: Temporal.PlainDate, timeZone: TimeZone): Days {
  return daysFrom(date.subtract({ days: date.dayOfWeek - 1 }), 7, timeZone);
}

/** `count` local days starting on `date`. */
export function daysFrom(date: Temporal.PlainDate, count: number, timeZone: TimeZone): Days {
  return {
    dates: Array.from({ length: count }, (_, i) => date.add({ days: i }).toString()),
    range: { start: startOfDay(date, timeZone), end: startOfDay(date.add({ days: count }), timeZone) },
  };
}

/** The date in a `date` search parameter, or `undefined` unless it is a single valid `YYYY-MM-DD` date. */
export function parseDateParam(value: string | string[] | undefined): Temporal.PlainDate | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" });
  } catch {
    return undefined;
  }
}

export interface WeekNavigation {
  /** Monday of the previous week. */
  previous: string;
  /** Monday of the next week. */
  next: string;
  /** Negative for weeks before the one containing `today`. */
  weeksFromToday: number;
}

/** Links around the week starting on `monday`, as local dates. */
export function weekNavigation(monday: string, today: string): WeekNavigation {
  const start = Temporal.PlainDate.from(monday);
  const todayDate = Temporal.PlainDate.from(today);
  const todayMonday = todayDate.subtract({ days: todayDate.dayOfWeek - 1 });

  return {
    previous: start.subtract({ weeks: 1 }).toString(),
    next: start.add({ weeks: 1 }).toString(),
    weeksFromToday: todayMonday.until(start, { largestUnit: "weeks" }).weeks,
  };
}

export interface DayNavigation {
  /** First of the `count` days before. */
  previous: string;
  /** First of the `count` days after. */
  next: string;
}

/** Links around the `count` days starting on `start`, as local dates. */
export function dayNavigation(start: string, count: number): DayNavigation {
  const first = Temporal.PlainDate.from(start);
  return { previous: first.subtract({ days: count }).toString(), next: first.add({ days: count }).toString() };
}
