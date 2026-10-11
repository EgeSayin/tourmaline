import type { Category, CategoryColor } from "./categories";
import type { FixedItem, Item } from "./items";
import { type Placement, type PlacementRef, type PlacementState, placementState } from "./placements";
import { toLocal } from "./time/local-time";
import type { TimeZone } from "./time/time-zone";

const MINUTES_PER_DAY = 24 * 60;

/** The item a block or entry belongs to, as the editor opens it, and which occurrence it is. */
export interface EditTarget {
  /** The stored item: a series at its next occurrence (as saved once it has ended), under the series' id. */
  item: Item;
  /** The occurrence's local date (`YYYY-MM-DD`), or `null` for a one-off item. */
  occurrenceDate: string | null;
}

export type BlockStyle = "fixed" | "fixed-optional" | "scheduled" | "to-review" | "done" | "missed";

/** A scheduled block's own placement, as it stands at the time the blocks were built. */
export interface BlockPlacement {
  ref: PlacementRef;
  state: PlacementState;
  pinned: boolean;
}

export function toBlockPlacement(placement: Placement, now: Date): BlockPlacement {
  return {
    ref: { taskId: placement.taskId, start: placement.start },
    state: placementState(placement, now),
    pinned: placement.pinned,
  };
}

export interface CalendarBlock {
  /** Unique among the blocks. */
  key: string;
  title: string;
  start: Date;
  end: Date;
  style: BlockStyle;
  /** Low-priority scheduled tasks are shown faded. */
  faded: boolean;
  /** Its item's category's colour, or `null` without a category. */
  color: CategoryColor | null;
  /** Local `YYYY-MM-DD` of the block's start. */
  date: string;
  startMinute: number;
  endMinute: number;
  target: EditTarget;
  /** `null` for a fixed item. */
  placement: BlockPlacement | null;
}

/**
 * Positions fixed items and placements on their local day, each with the edit target `targetFor` finds for its item
 * or occurrence id; a placement without one, whose item is gone, is skipped. A block running past midnight is cut
 * off at the end of the day it starts on. Scheduled blocks are styled by their placement's state at `now`, and every
 * block is coloured by its item's category among `categories`.
 */
export function toCalendarBlocks(
  fixedItems: FixedItem[],
  placements: Placement[],
  timeZone: TimeZone,
  targetFor: (id: string) => EditTarget | undefined,
  categories: Category[],
  now: Date,
): CalendarBlock[] {
  const colors = new Map(categories.map((category) => [category.id, category.color]));
  const unpositioned = [
    ...fixedItems.map((item) => ({ key: item.id, id: item.id, start: item.start, end: item.end, placement: null })),
    ...placements.map((placement) => ({
      key: `${placement.taskId}@${placement.start.toISOString()}`,
      id: placement.taskId,
      start: placement.start,
      end: placement.end,
      placement: toBlockPlacement(placement, now),
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
      style: blockStyle(item, block.placement),
      faded: item.timing === "flexible" && item.priority === "low",
      color: colors.get(item.categoryId ?? "") ?? null,
      date: start.date,
      startMinute: start.minuteOfDay,
      endMinute: end.date === start.date ? end.minuteOfDay : MINUTES_PER_DAY,
      target,
    };
  });
}

function blockStyle(item: Item, placement: BlockPlacement | null): BlockStyle {
  if (placement) {
    const { state } = placement;
    return state === "planned" || state === "in-progress" ? "scheduled" : state;
  }
  return item.priority === "mandatory" ? "fixed" : "fixed-optional";
}
