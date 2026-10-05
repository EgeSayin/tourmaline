import type { OccurrenceOverride, Recurrence } from "./recurrence";
import type { DailyWindow } from "./time-of-day";

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
  /** For a recurring task, the first occurrence's; each occurrence's window ends where the rule next occurs. */
  deadline: Date;
  /** `null` means the item must be placed as a single block. */
  split: { minChunkMin: number; maxChunkMin: number } | null;
  /** Empty means no preference. */
  preferredWindows: DailyWindow[];
  spread: SpreadStrategy;
}

export type Item = FixedItem | FlexibleItem;

/** An item as created or edited: the database assigns its `id`, and occurrences are overridden separately. */
export type NewItem = Omit<FixedItem, "id" | "overrides"> | Omit<FlexibleItem, "id" | "overrides">;
