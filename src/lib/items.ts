import type { OccurrenceChanges, Occurrences, Recurrence } from "./recurrence";
import { addMinutes } from "./time/duration";
import type { Interval } from "./time/interval";
import type { DayRange } from "./time/time-of-day";

/** Most to least important. */
export const PRIORITIES = ["mandatory", "high", "normal", "low"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const SPREAD_STRATEGIES = ["asap", "even", "just-in-time"] as const;

export type SpreadStrategy = (typeof SPREAD_STRATEGIES)[number];

interface BaseItem {
  id: string;
  title: string;
  priority: Priority;
  /** `null` for a one-off item. The item's own start sets each occurrence's local time and the series' first date. */
  recurrence: Recurrence | null;
  /** Empty for a one-off item. */
  occurrences: Occurrences;
  /** Empty for a one-off item. */
  changes: OccurrenceChanges;
  categoryId: string | null;
}

export interface FixedItem extends BaseItem {
  timing: "fixed";
  start: Date;
  end: Date;
  location: string | null;
  bufferBeforeMin: number;
  bufferAfterMin: number;
}

export interface ChunkSizes {
  minChunkMin: number;
  maxChunkMin: number;
}

/** How a task is split: its chunk sizes, and the least time between two of its chunks. */
export interface Split extends ChunkSizes {
  breakMin: number;
}

/** The hours of the day a task's blocks go in, the same every day: only these when `must`, otherwise these if they fit. */
export interface TimeOfDay extends DayRange {
  must: boolean;
}

export interface Task extends BaseItem {
  timing: "flexible";
  durationMin: number;
  earliestStart: Date;
  /** For a recurring task, the first occurrence's; each occurrence's window ends where the rule next occurs. */
  deadline: Date;
  split: Split | null;
  spread: SpreadStrategy;
  /**
   * For a repeating task: each occurrence is due by the end of its own period, its `interval` days or weeks, when that
   * comes before the next occurrence, so time it misses is never planned past it. Always `false` for a one-off task.
   */
  withinPeriod: boolean;
  /**
   * For a repeating task kept within its period: each occurrence takes only the time other tasks leave, up to
   * `durationMin`, and what doesn't fit is let go, never queued. Always `false` otherwise.
   */
  upTo: boolean;
  /**
   * For a repeating task: the time after which the series stops, counting its blocks that weren't missed, or `null` to
   * go on. Always `null` for a one-off task.
   */
  totalMin: number | null;
  timeOfDay: TimeOfDay | null;
  /** Marked done as a whole, so it isn't planned. An occurrence's comes from its state. */
  done: boolean;
}

export type Item = FixedItem | Task;

/**
 * An item as created or edited: the database assigns its `id`, and its occurrences' states and changes and whether
 * a task is done are set separately.
 */
export type NewItem = NewFixedItem | NewTask;

export type NewFixedItem = Omit<FixedItem, "id" | "occurrences" | "changes">;

export type NewTask = Omit<Task, "id" | "occurrences" | "changes" | "done">;

export const isFixed = <T extends NewItem>(item: T): item is Extract<T, { timing: "fixed" }> => item.timing === "fixed";
export const isTask = <T extends NewItem>(item: T): item is Extract<T, { timing: "flexible" }> =>
  item.timing === "flexible";

/** When the item can happen: a fixed item's start to end, or a task's earliest start to deadline. */
export function itemSpan(item: NewItem): Interval {
  return item.timing === "fixed"
    ? { start: item.start, end: item.end }
    : { start: item.earliestStart, end: item.deadline };
}

/** The time a fixed item keeps from tasks: itself and its buffers. */
export function bufferedSpan(item: NewFixedItem): Interval {
  return {
    start: addMinutes(item.start, -item.bufferBeforeMin),
    end: addMinutes(item.end, item.bufferAfterMin),
  };
}

export function withSpan<T extends NewItem>(item: T, span: Interval): T {
  return item.timing === "fixed"
    ? { ...item, start: span.start, end: span.end }
    : { ...item, earliestStart: span.start, deadline: span.end };
}
