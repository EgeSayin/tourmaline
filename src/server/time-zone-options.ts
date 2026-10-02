import "server-only";
import { TIME_ZONES, type TimeZone } from "@/lib/time-zone";

export interface TimeZoneOption {
  value: TimeZone;
  /** UTC offset at the given instant, e.g. "-04:00". */
  offset: string;
}

/** Unique zones sorted by their UTC offset at `now`, then by name. */
export function timeZoneOptions(now: Temporal.Instant = Temporal.Now.instant()): TimeZoneOption[] {
  return [...new Set(TIME_ZONES)]
    .map((value) => ({ value, zoned: now.toZonedDateTimeISO(value) }))
    .sort((a, b) => a.zoned.offsetNanoseconds - b.zoned.offsetNanoseconds || a.value.localeCompare(b.value))
    .map(({ value, zoned }) => ({ value, offset: zoned.offset }));
}
