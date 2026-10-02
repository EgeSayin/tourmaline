import "server-only";

export function toDate(time: Temporal.Instant | Temporal.ZonedDateTime): Date {
  return new Date(time.epochMilliseconds);
}
