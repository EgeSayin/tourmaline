/** Local time of day in minutes after midnight. Wraps past midnight when `endMinute < startMinute`. */
export interface DailyWindow {
  startMinute: number;
  endMinute: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function toTimeInputValue(minuteOfDay: number): string {
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}
