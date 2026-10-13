import { type Downtime, nightly } from "@/lib/downtime";
import type { TimeZone } from "@/lib/time/time-zone";

/**
 * The most minutes of fixed items and task blocks to fill each local day with, Monday first, `null` for no cap. Tasks
 * go over it only to fit before their deadline.
 */
export type FocusCaps = readonly (number | null)[];

export const NO_FOCUS_CAPS: FocusCaps = [null, null, null, null, null, null, null];

export const focusCapField = (weekday: number) => `cap${weekday}`;

/** Submitted as one "0" or "1" per `DAY_STEP_MIN` of the day. */
export const downtimeField = (weekday: number) => `downtime${weekday}`;

export interface SchedulerSettings {
  timeZone: TimeZone;
  downtime: Downtime;
  focusCaps: FocusCaps;
}

export const DEFAULT_SETTINGS: SchedulerSettings = {
  timeZone: "UTC",
  downtime: nightly(23 * 60, 10 * 60),
  focusCaps: NO_FOCUS_CAPS,
};

/** How far ahead recurring tasks are planned at most, so a far-off deadline doesn't plan months of occurrences. */
export const RECURRENCE_LOOKAHEAD_DAYS = 28;

/** The least time between two chunks of the same task, so a split task's chunks don't run together. */
export const CHUNK_BREAK_MIN = 30;

/**
 * How far past its focus cap a day may be filled, tried in turn, so a task that fits only over the caps goes over
 * them as little as it can.
 */
export const FOCUS_CAP_RAISES_MIN = [0, 30, 60, 120, 240, 480, Infinity];

export const OCCURRENCES_SHOWN = 7;
