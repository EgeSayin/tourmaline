import "server-only";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";

export function toDate(time: Temporal.Instant | Temporal.ZonedDateTime): Date {
  return new Date(time.epochMilliseconds);
}

export function zoned(date: Date, timeZone: TimeZone): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZone);
}

export function localDate(date: Date, timeZone: TimeZone): Temporal.PlainDate {
  return zoned(date, timeZone).toPlainDate();
}

/** Midnight at the start of local `day`, or the first moment of it where a clock change skips midnight. */
export function startOfDay(day: Temporal.PlainDate, timeZone: TimeZone): Date {
  return toDate(day.toZonedDateTime(timeZone));
}

/** Local `day` at `minuteOfDay` minutes after midnight, which may be `MINUTES_PER_DAY` (the next midnight). */
export function atLocalTime(day: Temporal.PlainDate, minuteOfDay: number, timeZone: TimeZone): Date {
  if (minuteOfDay === MINUTES_PER_DAY) return startOfDay(day.add({ days: 1 }), timeZone);
  const plainTime = new Temporal.PlainTime(Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  return toDate(day.toZonedDateTime({ timeZone, plainTime }));
}
