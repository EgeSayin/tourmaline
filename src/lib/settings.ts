import type { DailyWindow } from "./time-of-day";
import type { TimeZone } from "./time-zone";

export interface SchedulerSettings {
  timeZone: TimeZone;
  downtime: DailyWindow;
}

export const DEFAULT_SETTINGS: Omit<SchedulerSettings, "timeZone"> = {
  downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
};
