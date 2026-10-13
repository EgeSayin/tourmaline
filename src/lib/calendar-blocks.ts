import type { Category, CategoryColor } from "./categories";
import { type FixedItem, type Item, PRIORITIES } from "./items";
import { type Placement, type PlacementRef, type PlacementState, placementState } from "./placements";
import { addMinutes } from "./time/duration";
import { overlaps } from "./time/interval";
import { toLocal } from "./time/local-time";
import { MINUTES_PER_DAY } from "./time/time-of-day";
import type { TimeZone } from "./time/time-zone";

/** The item a block or entry belongs to, as the editor opens it, and which occurrence it is. */
export interface EditTarget {
  /** The stored item: a series at its next occurrence (as saved once it has ended), under the series' id. */
  item: Item;
  occurrenceDate: string | null;
}

export type BlockStyle = "fixed" | "fixed-optional" | "displaced" | "scheduled" | "to-review" | "done" | "missed";

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
  /**
   * A fixed item overlapping another one or a block that stays where it is (pinned, in progress or done), and that
   * block; not an optional fixed item a more important task's block displaces (`displaced` style), nor that block.
   */
  conflict: boolean;
  /** A fixed item's buffers before and after it, on the same date, in local minutes. */
  buffers: { startMinute: number; endMinute: number }[];
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
    ...fixedItems.map((item) => ({
      key: item.id,
      id: item.id,
      start: item.start,
      end: item.end,
      placement: null,
      bufferMin: [item.bufferBeforeMin, item.bufferAfterMin],
    })),
    ...placements.map((placement) => ({
      key: `${placement.taskId}@${placement.start.toISOString()}`,
      id: placement.taskId,
      start: placement.start,
      end: placement.end,
      placement: toBlockPlacement(placement, now),
      bufferMin: [0, 0],
    })),
  ];

  const positioned = unpositioned.flatMap(({ id, bufferMin: [beforeMin, afterMin], ...block }) => {
    const target = targetFor(id);
    if (!target) return [];
    const { item } = target;
    const start = toLocal(block.start, timeZone);
    const end = toLocal(block.end, timeZone);
    const endMinute = end.date === start.date ? end.minuteOfDay : MINUTES_PER_DAY;
    // Cut off at the block's date, like the block.
    const minuteOn = (date: Date, outside: number) => {
      const local = toLocal(date, timeZone);
      return local.date === start.date ? local.minuteOfDay : outside;
    };
    const buffers = [
      { startMinute: minuteOn(addMinutes(block.start, -beforeMin), 0), endMinute: start.minuteOfDay },
      { startMinute: endMinute, endMinute: minuteOn(addMinutes(block.end, afterMin), MINUTES_PER_DAY) },
    ].filter((buffer) => buffer.startMinute < buffer.endMinute);
    return {
      ...block,
      title: item.title,
      style: blockStyle(item, block.placement),
      color: colors.get(item.categoryId ?? "") ?? null,
      date: start.date,
      startMinute: start.minuteOfDay,
      endMinute,
      target,
      buffers,
      busy: { start: addMinutes(block.start, -beforeMin), end: addMinutes(block.end, afterMin) },
    };
  });
  type Positioned = (typeof positioned)[number];
  const fixed = positioned.filter((block) => block.placement === null);
  const tasks = positioned.filter((block) => block.placement !== null);
  const staying = tasks.filter(
    ({ placement }) => placement!.pinned || placement!.state === "in-progress" || placement!.state === "done",
  );
  const rank = (block: Positioned) => PRIORITIES.indexOf(block.target.item.priority);
  // The scheduler lets a more important task take an optional fixed item's time, buffers included, when it fits
  // nowhere else.
  const displaces = (task: Positioned, item: Positioned) =>
    item.target.item.priority !== "mandatory" &&
    task.placement!.state !== "missed" &&
    rank(task) < rank(item) &&
    overlaps(task, item.busy);
  const clash = (block: Positioned, other: Positioned) => other !== block && overlaps(block, other);

  return withLanes(
    positioned.map((block) => {
      const { busy: _, ...shown } = block;
      if (block.placement !== null) {
        return {
          ...shown,
          conflict: staying.includes(block) && fixed.some((f) => clash(block, f) && !displaces(block, f)),
        };
      }
      return {
        ...shown,
        style: tasks.some((task) => displaces(task, block)) ? "displaced" : shown.style,
        conflict: fixed.some((f) => clash(block, f)) || staying.some((t) => clash(block, t) && !displaces(t, block)),
      };
    }),
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
