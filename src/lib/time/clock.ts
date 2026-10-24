import { MINUTES_PER_DAY, toTimeInputValue } from "./time-of-day";

export const CLOCK_FORMATS = ["24h", "12h"] as const;

/**
 * How times of day are shown and typed: on a 24-hour clock, or a 12-hour one with AM and PM. Only the UI converts:
 * the server always takes and stores 24-hour times.
 */
export type ClockFormat = (typeof CLOCK_FORMATS)[number];

export const isClockFormat = (value: unknown): value is ClockFormat => CLOCK_FORMATS.includes(value as ClockFormat);

/** For a browser whose language names no clock. */
export const DEFAULT_CLOCK_FORMAT: ClockFormat = "24h";

/** The clock `locale`'s times are written on, e.g. "12h" for "en-US" and "24h" for "en-GB". */
export function clockFormatOfLocale(locale: string | undefined): ClockFormat {
  if (!locale) return DEFAULT_CLOCK_FORMAT;
  try {
    const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions();
    return hourCycle === "h11" || hourCycle === "h12" ? "12h" : "24h";
  } catch {
    return DEFAULT_CLOCK_FORMAT;
  }
}

export type Period = "AM" | "PM";

/** A time of day as a clock reads it: hours 0–23 on a 24-hour clock, or 1–12 and a period on a 12-hour one. */
export interface ClockReading {
  hours: number;
  minutes: number;
  period?: Period;
}

/** How a clock in `format` reads `minuteOfDay`; the next midnight reads as midnight. */
export function toReading(minuteOfDay: number, format: ClockFormat): ClockReading {
  const minute = minuteOfDay % MINUTES_PER_DAY;
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  if (format === "24h") return { hours, minutes };
  return { hours: hours % 12 || 12, minutes, period: hours < 12 ? "AM" : "PM" };
}

/** The minute of the day `reading` names, or `null` when no clock reads it so. */
export function fromReading({ hours, minutes, period }: ClockReading): number | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60) return null;
  if (period === undefined) return hours >= 0 && hours < 24 ? hours * 60 + minutes : null;
  if (hours < 1 || hours > 12) return null;
  return ((hours % 12) + (period === "PM" ? 12 : 0)) * 60 + minutes;
}

/** E.g. "14:30" or "2:30 PM"; on a 24-hour clock, the next midnight is "24:00". */
export function formatTimeOfDay(minuteOfDay: number, format: ClockFormat): string {
  if (format === "24h") return toTimeInputValue(minuteOfDay);
  const { hours, minutes, period } = toReading(minuteOfDay, format);
  return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** E.g. "14:00–15:30", "2:00–3:30 PM" or "11:00 AM–12:15 PM": a period both ends share is written once. */
export function formatTimeOfDayRange(start: number, end: number, format: ClockFormat): string {
  const from = formatTimeOfDay(start, format);
  const until = formatTimeOfDay(end, format);
  if (format === "12h" && toReading(start, format).period === toReading(end, format).period) {
    return `${from.slice(0, -3)}–${until}`;
  }
  return `${from}–${until}`;
}

/** A label for a whole hour, e.g. "14:00" or "2 PM". */
export function formatHour(hour: number, format: ClockFormat): string {
  if (format === "24h") return formatTimeOfDay(hour * 60, format);
  const { hours, period } = toReading(hour * 60, format);
  return `${hours} ${period}`;
}
