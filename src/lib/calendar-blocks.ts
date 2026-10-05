import type { FixedItem, FlexibleItem, Item } from "./items";
import { toLocal } from "./local-time";
import type { Placement } from "./placements";
import { seriesOf } from "./recurrence";
import type { TimeZone } from "./time-zone";

const MINUTES_PER_DAY = 24 * 60;

export interface CalendarItems {
  /** Stored items: one-offs, and each series as saved. */
  items: Item[];
  /** One-off fixed items and fixed occurrences. */
  fixedItems: FixedItem[];
  /** One-off tasks and task occurrences. */
  flexibleItems: FlexibleItem[];
  placements: Placement[];
}

export type BlockStyle = "fixed" | "fixed-optional" | "scheduled";

export interface CalendarBlock {
  /** Unique among the blocks. */
  key: string;
  item: Item;
  start: Date;
  end: Date;
  style: BlockStyle;
  /** Low-priority scheduled tasks are shown faded. */
  faded: boolean;
  /** Local `YYYY-MM-DD` of the block's start. */
  date: string;
  startMinute: number;
  endMinute: number;
}

/**
 * Positions fixed items and placements on their local day. A placement whose task isn't in `flexibleItems`, such as
 * one for an occurrence its series no longer has, is shown under its stored item in `items`, or skipped if that's
 * gone too. A block running past midnight is cut off at the end of the day it starts on.
 */
export function toCalendarBlocks(
  { items, fixedItems, flexibleItems, placements }: CalendarItems,
  timeZone: TimeZone,
): CalendarBlock[] {
  const tasks = new Map(flexibleItems.map((item) => [item.id, item]));

  const unpositioned = [
    ...fixedItems.map((item) => ({
      key: item.id,
      item,
      start: item.start,
      end: item.end,
      style: item.priority === "mandatory" ? ("fixed" as const) : ("fixed-optional" as const),
      faded: false,
    })),
    ...placements.flatMap((placement) => {
      const task = tasks.get(placement.itemId) ?? seriesOf(items, placement.itemId);
      if (!task) return [];
      return {
        key: `${placement.itemId}@${placement.start.toISOString()}`,
        item: task,
        start: placement.start,
        end: placement.end,
        style: "scheduled" as const,
        faded: task.priority === "low",
      };
    }),
  ];

  return unpositioned.map((block) => {
    const start = toLocal(block.start, timeZone);
    const end = toLocal(block.end, timeZone);
    const endMinute = end.date === start.date ? end.minuteOfDay : MINUTES_PER_DAY;
    return { ...block, date: start.date, startMinute: start.minuteOfDay, endMinute };
  });
}
