/** Local time of day in minutes after midnight. Wraps past midnight when `endMinute < startMinute`. */
export interface DailyWindow {
  startMinute: number;
  endMinute: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A `time` input value such as "09:05". */
export function toTimeInputValue(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}

/** Minutes after midnight of a valid `time` input value such as "09:05". */
export function fromTimeInputValue(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
