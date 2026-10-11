export const MINUTES_PER_DAY = 24 * 60;

/** Local minutes after midnight, `startMinute` up to `endMinute`, which may be `MINUTES_PER_DAY` (the next midnight). */
export interface DayRange {
  startMinute: number;
  endMinute: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function toTimeInputValue(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}
