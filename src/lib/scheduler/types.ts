import type { TimeZone } from "./time-zone";

/** `end` is exclusive. */
export interface Interval {
  start: Date;
  end: Date;
}

/** Local time of day in minutes after midnight. Wraps past midnight when `endMinute < startMinute`. */
export interface DailyWindow {
  startMinute: number;
  endMinute: number;
}

export type Priority = "mandatory" | "high" | "normal" | "low";

export type SpreadStrategy = "asap" | "even" | "just-in-time";

interface BaseItem {
  id: string;
  title: string;
  priority: Priority;
}

export interface FixedItem extends BaseItem {
  timing: "fixed";
  start: Date;
  end: Date;
  location: string | null;
  bufferBeforeMin: number;
  bufferAfterMin: number;
}

export interface FlexibleItem extends BaseItem {
  timing: "flexible";
  durationMin: number;
  earliestStart: Date;
  deadline: Date;
  /** `null` means the item must be placed as a single block. */
  split: { minChunkMin: number; maxChunkMin: number } | null;
  /** Empty means no preference. */
  preferredWindows: DailyWindow[];
  spread: SpreadStrategy;
}

export type Item = FixedItem | FlexibleItem;

export interface SchedulerSettings {
  timeZone: TimeZone;
  downtime: DailyWindow;
}

export const DEFAULT_SETTINGS: Omit<SchedulerSettings, "timeZone"> = {
  downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
};
