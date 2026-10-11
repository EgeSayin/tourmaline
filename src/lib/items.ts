import type { OccurrenceOverride, Recurrence } from "./recurrence";
import type { Interval } from "./time/interval";

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
  /** At most one per occurrence date, sorted by date; empty for a one-off item. */
  overrides: OccurrenceOverride[];
  /** The `Category` it belongs to, if any. */
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

/** How long each chunk of a split task may be. */
export interface ChunkSizes {
  minChunkMin: number;
  maxChunkMin: number;
}

export interface Task extends BaseItem {
  timing: "flexible";
  durationMin: number;
  earliestStart: Date;
  /** For a recurring task, the first occurrence's; each occurrence's window ends where the rule next occurs. */
  deadline: Date;
  /** `null` means the item must be placed as a single block. */
  split: ChunkSizes | null;
  spread: SpreadStrategy;
  /** Marked done as a whole, so it isn't planned. An occurrence's comes from its override. */
  done: boolean;
}

export type Item = FixedItem | Task;

/**
 * An item as created or edited: the database assigns its `id`, occurrences are overridden separately, and a task is
 * marked done separately.
 */
export type NewItem = Omit<FixedItem, "id" | "overrides"> | NewTask;

export type NewTask = Omit<Task, "id" | "overrides" | "done">;

export const isFixed = <T extends NewItem>(item: T): item is Extract<T, { timing: "fixed" }> => item.timing === "fixed";
export const isTask = <T extends NewItem>(item: T): item is Extract<T, { timing: "flexible" }> =>
  item.timing === "flexible";

/** When the item can happen: a fixed item's start to end, or a task's earliest start to deadline. */
export function itemSpan(item: NewItem): Interval {
  return item.timing === "fixed"
    ? { start: item.start, end: item.end }
    : { start: item.earliestStart, end: item.deadline };
}

/** `item` moved to happen within `span`, as `itemSpan` reads it. */
export function withSpan<T extends NewItem>(item: T, span: Interval): T {
  return item.timing === "fixed"
    ? { ...item, start: span.start, end: span.end }
    : { ...item, earliestStart: span.start, deadline: span.end };
}
