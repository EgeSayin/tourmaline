import type { DailyWindow } from "@/lib/time/time-of-day";
import type { TimeZone } from "@/lib/time/time-zone";

/**
 * The most minutes of fixed items and task blocks to fill each local day with, Monday first, `null` for no cap. Tasks
 * go over it only to fit before their deadline.
 */
export type FocusCaps = readonly (number | null)[];

export const NO_FOCUS_CAPS: FocusCaps = [null, null, null, null, null, null, null];

/** The settings form field holding ISO weekday `weekday`'s focus cap, in hours. */
export const focusCapField = (weekday: number) => `cap${weekday}`;

export interface SchedulerSettings {
  timeZone: TimeZone;
  downtime: DailyWindow;
  focusCaps: FocusCaps;
}

export const DEFAULT_SETTINGS: Omit<SchedulerSettings, "timeZone"> = {
  downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
  focusCaps: NO_FOCUS_CAPS,
};

/** How far ahead recurring tasks are planned at most, so a far-off deadline doesn't plan months of occurrences. */
export const RECURRENCE_LOOKAHEAD_DAYS = 28;

/** The least time between two chunks of the same task, so a split task's chunks don't run together. */
export const CHUNK_BREAK_MIN = 30;

/** How many upcoming occurrences a series' editor lists. */
export const OCCURRENCES_SHOWN = 7;
