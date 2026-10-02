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

/** An item before the database assigns its `id`. */
export type NewItem = Omit<FixedItem, "id"> | Omit<FlexibleItem, "id">;
