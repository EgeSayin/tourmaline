import type { TimeZone } from "@/lib/time/time-zone";
import type { Interval } from "@/lib/time/interval";
import { startOfDay } from "@/server/time/temporal";

export interface Days {
  dates: string[];
  /** From the first day's midnight to the midnight after the last, local time. */
  range: Interval;
}

export const PHONE_DAY_COUNT = 3;

/** The Monday-to-Sunday week, in local time, that contains `date`. */
export function weekOf(date: Temporal.PlainDate, timeZone: TimeZone): Days {
  return daysFrom(date.subtract({ days: date.dayOfWeek - 1 }), 7, timeZone);
}

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
  previous: string;
  next: string;
  /** Negative for weeks before the one containing `today`. */
  weeksFromToday: number;
}

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
  previous: string;
  next: string;
}

export function dayNavigation(start: string, count: number): DayNavigation {
  const first = Temporal.PlainDate.from(start);
  return { previous: first.subtract({ days: count }).toString(), next: first.add({ days: count }).toString() };
}
