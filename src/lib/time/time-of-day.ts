/** Local time of day in minutes after midnight. Wraps past midnight when `endMinute < startMinute`. */
export interface DailyWindow {
  startMinute: number;
  endMinute: number;
}
