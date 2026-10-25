import { type Downtime, nightly } from "@/lib/downtime";
import type { TimeZone } from "@/lib/time/time-zone";

/** Submitted as one "0" or "1" per `DAY_STEP_MIN` of the day. */
export const downtimeField = (weekday: number) => `downtime${weekday}`;

export interface SchedulerSettings {
  timeZone: TimeZone;
  downtime: Downtime;
}

export const DEFAULT_SETTINGS: SchedulerSettings = {
  timeZone: "UTC",
  downtime: nightly(23 * 60, 10 * 60),
};

/** How far ahead recurring tasks are planned at most, so a far-off deadline doesn't plan months of occurrences. */
export const RECURRENCE_LOOKAHEAD_DAYS = 28;

/** The shortest and longest chunk of a split task that leaves them empty. */
export const DEFAULT_MIN_CHUNK_MIN = 30;
export const DEFAULT_MAX_CHUNK_MIN = 2 * 60;

/** The least time between two chunks of a split task that leaves it empty, so its chunks don't run together. */
export const DEFAULT_CHUNK_BREAK_MIN = 30;

export const OCCURRENCES_SHOWN = 7;

/** The amounts a block's task is offered to be bumped by at a click: an hour, half a day, a day. */
export const BUMP_PRESETS_MIN = [60, 12 * 60, 24 * 60];

/** How many weeks the stats page looks back over, this one included. */
export const STATS_WEEKS = 8;
