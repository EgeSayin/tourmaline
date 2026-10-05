import type { FixedItem, Item } from "./items";
import type { Placement } from "./placements";
import { toLocal } from "./time/local-time";
import type { TimeZone } from "./time/time-zone";

const MINUTES_PER_DAY = 24 * 60;

/** What opens in the edit form, and which occurrence it was opened from. */
export interface EditTarget {
  /** The stored item: a series at its next occurrence (as saved once it has ended), under the series' id. */
  item: Item;
  /** The occurrence's local date (`YYYY-MM-DD`), or `null` for a one-off item. */
  occurrenceDate: string | null;
}

export type BlockStyle = "fixed" | "fixed-optional" | "scheduled";

export interface CalendarBlock {
  /** Unique among the blocks. */
  key: string;
  title: string;
  start: Date;
  end: Date;
  style: BlockStyle;
  /** Low-priority scheduled tasks are shown faded. */
  faded: boolean;
  /** Local `YYYY-MM-DD` of the block's start. */
  date: string;
  startMinute: number;
  endMinute: number;
  target: EditTarget;
}

/**
 * Positions fixed items and placements on their local day, each with the edit target `targetFor` finds for its item
 * or occurrence id; a placement without one, whose item is gone, is skipped. A block running past midnight is cut
 * off at the end of the day it starts on.
 */
export function toCalendarBlocks(
  fixedItems: FixedItem[],
  placements: Placement[],
  timeZone: TimeZone,
  targetFor: (id: string) => EditTarget | undefined,
): CalendarBlock[] {
  const unpositioned = [
    ...fixedItems.map((item) => ({ key: item.id, id: item.id, start: item.start, end: item.end })),
    ...placements.map((placement) => ({
      key: `${placement.taskId}@${placement.start.toISOString()}`,
      id: placement.taskId,
      start: placement.start,
      end: placement.end,
    })),
  ];

  return unpositioned.flatMap(({ id, ...block }) => {
    const target = targetFor(id);
    if (!target) return [];
    const { item } = target;
    const start = toLocal(block.start, timeZone);
    const end = toLocal(block.end, timeZone);
    return {
      ...block,
      title: item.title,
      style: blockStyle(item),
      faded: item.timing === "flexible" && item.priority === "low",
      date: start.date,
      startMinute: start.minuteOfDay,
      endMinute: end.date === start.date ? end.minuteOfDay : MINUTES_PER_DAY,
      target,
    };
  });
}

function blockStyle(item: Item): BlockStyle {
  if (item.timing === "flexible") return "scheduled";
  return item.priority === "mandatory" ? "fixed" : "fixed-optional";
}
