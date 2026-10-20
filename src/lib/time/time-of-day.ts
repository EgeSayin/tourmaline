export const MINUTES_PER_DAY = 24 * 60;

/** Local minutes after midnight, `startMinute` up to `endMinute`, which may be `MINUTES_PER_DAY` (the next midnight). */
export interface DayRange {
  startMinute: number;
  endMinute: number;
}

/**
 * Ranges for each weekday, Monday first, each day's sorted with gaps between them. A stretch past midnight goes on as
 * the next weekday's first range.
 */
export type WeeklyRanges = readonly (readonly DayRange[])[];

/** `range` on every weekday. */
export const everyDay = (range: DayRange): WeeklyRanges => Array.from({ length: 7 }, () => [range]);

const pad = (value: number) => String(value).padStart(2, "0");

export function toTimeInputValue(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}

/** Minutes after midnight of an `<input type="time">` value, e.g. "14:30". */
export function fromTimeInputValue(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
