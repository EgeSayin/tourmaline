import "server-only";
import type { FlexibleItem } from "@/lib/items";
import type { TimeZone } from "@/lib/time-zone";
import type { Interval } from "@/server/scheduler/intervals";
import { toDate } from "@/server/temporal";

export interface Week {
  monday: Temporal.PlainDate;
  /** Monday 00:00 to the next Monday 00:00, local time. */
  range: Interval;
}

/** The Monday-to-Sunday week, in local time, that contains `instant`. */
export function weekContaining(instant: Temporal.Instant, timeZone: TimeZone): Week {
  return weekOf(instant.toZonedDateTimeISO(timeZone).toPlainDate(), timeZone);
}

/** The Monday-to-Sunday week, in local time, that contains `date`. */
export function weekOf(date: Temporal.PlainDate, timeZone: TimeZone): Week {
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  const startOf = (day: Temporal.PlainDate) => toDate(day.toZonedDateTime(timeZone));

  return { monday, range: { start: startOf(monday), end: startOf(monday.add({ weeks: 1 })) } };
}

/**
 * The span to plan: from the start of the `current` week to the latest task deadline, but at least to the end of
 * that week and at most to the end of the `horizonWeeks`-th week, counting the current one.
 */
export function planningHorizon(
  current: Week,
  tasks: FlexibleItem[],
  horizonWeeks: number,
  timeZone: TimeZone,
): Interval {
  const cap = weekOf(current.monday.add({ weeks: horizonWeeks - 1 }), timeZone).range.end;
  let end = current.range.end;
  for (const task of tasks) if (task.deadline > end) end = task.deadline;
  return { start: current.range.start, end: end < cap ? end : cap };
}

/** The date in a `week` search parameter, or `undefined` unless it is a single valid `YYYY-MM-DD` date. */
export function parseWeekParam(value: string | string[] | undefined): Temporal.PlainDate | undefined {
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
