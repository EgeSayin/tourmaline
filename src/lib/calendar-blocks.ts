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
  occurrenceDate: string | null;
}

export type BlockStyle = "fixed" | "fixed-optional" | "scheduled" | "to-review" | "done" | "missed";

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
  key: string;
  title: string;
  start: Date;
  end: Date;
  style: BlockStyle;
  color: CategoryColor | null;
  date: string;
  startMinute: number;
  endMinute: number;
  lane: number;
  lanes: number;
  target: EditTarget;
  placement: BlockPlacement | null;
  /** A fixed item overlapping another one. */
  conflict: boolean;
}

/** Positions blocks on the local day they start, cut off at midnight. Placements whose item is gone are skipped. */
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

export interface DaySpan {
  date: string;
  startMinute: number;
  endMinute: number;
}

/** Overlapping spans on a date get different lanes, and all of a group share its lane count. */
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
