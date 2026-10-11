import type { TimeZone } from "@/lib/time/time-zone";
import { zoned } from "@/server/time/temporal";

export interface TimeZoneOption {
  value: TimeZone;
  label: string;
}

/** Every time zone the runtime knows, sorted by its UTC offset at `now`, e.g. "UTC+03:00 · Europe/Istanbul". */
export function timeZoneOptions(now: Date): TimeZoneOption[] {
  return [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])]
    .map((timeZone) => ({ timeZone, local: zoned(now, timeZone) }))
    .sort((a, b) => a.local.offsetNanoseconds - b.local.offsetNanoseconds || a.timeZone.localeCompare(b.timeZone))
    .map(({ timeZone, local }) => ({
      value: timeZone,
      label: `UTC${local.offset} · ${timeZone.replaceAll("_", " ")}`,
    }));
}
