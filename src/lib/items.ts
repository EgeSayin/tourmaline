import type { DailyWindow } from "./time-of-day";

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
