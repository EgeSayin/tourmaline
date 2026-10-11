import type { Category, CategoryColor } from "./categories";
import type { FixedItem, Item } from "./items";
import { type Placement, type PlacementRef, type PlacementState, placementState } from "./placements";
import { overlaps } from "./time/interval";
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
  /** Its item's category's colour, or `null` without a category. */
  color: CategoryColor | null;
  /** Local `YYYY-MM-DD` of the block's start. */
  date: string;
  startMinute: number;
  endMinute: number;
  /** Which of `lanes` side-by-side columns it takes (see `withLanes`). */
  lane: number;
  lanes: number;
  target: EditTarget;
  /** `null` for a fixed item. */
  placement: BlockPlacement | null;
  /** A fixed item that overlaps another of the fixed items given: both stay, and it's up to you to sort out. */
  conflict: boolean;
}

/**
 * Positions fixed items and placements on their local day, each with the edit target `targetFor` finds for its item
 * or occurrence id; a placement without one, whose item is gone, is skipped. A block running past midnight is cut
 * off at the end of the day it starts on. Scheduled blocks are styled by their placement's state at `now`, and every
 * block is coloured by its item's category among `categories`. Fixed items that overlap each other are marked as
 * conflicts.
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

  const positioned = unpositioned.flatMap(({ id, ...block }) => {
    const target = targetFor(id);
    if (!target) return [];
    const { item } = target;
    const start = toLocal(block.start, timeZone);
    const end = toLocal(block.end, timeZone);
    return {
      ...block,
      title: item.title,
      style: blockStyle(item, block.placement),
      color: colors.get(item.categoryId ?? "") ?? null,
      date: start.date,
      startMinute: start.minuteOfDay,
      endMinute: end.date === start.date ? end.minuteOfDay : MINUTES_PER_DAY,
      target,
    };
  });
  const fixed = positioned.filter((block) => block.placement === null);
  return withLanes(
    positioned.map((block) => ({
      ...block,
      conflict: block.placement === null && fixed.some((other) => other !== block && overlaps(block, other)),
    })),
  );
}

/** Where a block sits on its day. */
export interface DaySpan {
  date: string;
  startMinute: number;
  endMinute: number;
}

/**
 * `spans` in their order, each with a lane: overlapping spans on the same date get different lanes, and each span's
 * `lanes` counts the lanes its group of overlapping spans needs, so every lane index is below it. Spans that only
 * touch don't overlap.
 */
export function withLanes<T extends DaySpan>(spans: T[]): (T & { lane: number; lanes: number })[] {
  const laid = spans.map((span) => ({ ...span, lane: 0, lanes: 1 }));
  const order = [...laid].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );

  // Within a group of spans linked by overlaps, each span takes the first lane free at its start.
  let group: typeof laid = [];
  let laneEnds: number[] = [];
  const closeGroup = () => group.forEach((span) => (span.lanes = laneEnds.length));
  for (const span of order) {
    const groupEnd = Math.max(...laneEnds);
    if (group.length > 0 && (span.date !== group[0].date || span.startMinute >= groupEnd)) {
      closeGroup();
      group = [];
      laneEnds = [];
    }
    const free = laneEnds.findIndex((end) => end <= span.startMinute);
    span.lane = free === -1 ? laneEnds.length : free;
    laneEnds[span.lane] = span.endMinute;
    group.push(span);
  }
  closeGroup();
  return laid;
}

function blockStyle(item: Item, placement: BlockPlacement | null): BlockStyle {
  if (placement) {
    const { state } = placement;
    return state === "planned" || state === "in-progress" ? "scheduled" : state;
  }
  return item.priority === "mandatory" ? "fixed" : "fixed-optional";
}
