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
  const today = instant.toZonedDateTimeISO(timeZone).toPlainDate();
  const monday = today.subtract({ days: today.dayOfWeek - 1 });
  const startOf = (date: Temporal.PlainDate) => new Date(date.toZonedDateTime(timeZone).epochMilliseconds);

  return { monday, range: { start: startOf(monday), end: startOf(monday.add({ weeks: 1 })) } };
}
