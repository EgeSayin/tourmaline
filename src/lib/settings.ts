import type { DailyWindow } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";

export interface SchedulerSettings {
  timeZone: TimeZone;
  downtime: DailyWindow;
}

export const DEFAULT_SETTINGS: Omit<SchedulerSettings, "timeZone"> = {
  downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
};

/** How far ahead recurring tasks are planned at most, so a far-off deadline doesn't plan months of occurrences. */
export const RECURRENCE_LOOKAHEAD_DAYS = 28;
