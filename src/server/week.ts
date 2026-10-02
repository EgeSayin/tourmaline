import "server-only";
import type { TimeZone } from "@/lib/time-zone";
import type { Interval } from "@/server/scheduler/intervals";

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
  const startOf = (day: Temporal.PlainDate) => new Date(day.toZonedDateTime(timeZone).epochMilliseconds);

  return { monday, range: { start: startOf(monday), end: startOf(monday.add({ weeks: 1 })) } };
}
