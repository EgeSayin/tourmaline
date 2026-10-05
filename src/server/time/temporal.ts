import "server-only";
import type { TimeZone } from "@/lib/time/time-zone";

export function toDate(time: Temporal.Instant | Temporal.ZonedDateTime): Date {
  return new Date(time.epochMilliseconds);
}

/** The exact time `date` in `timeZone`, for local calendar maths. */
export function zoned(date: Date, timeZone: TimeZone): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZone);
}

/** The local date of `date` in `timeZone`. */
export function localDate(date: Date, timeZone: TimeZone): Temporal.PlainDate {
  return zoned(date, timeZone).toPlainDate();
}
