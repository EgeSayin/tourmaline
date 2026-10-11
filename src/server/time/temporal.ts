import "server-only";
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
