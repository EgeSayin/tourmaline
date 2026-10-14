import type { SpreadStrategy, Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { CHUNK_BREAK_MIN, FOCUS_CAP_RAISES_MIN } from "@/lib/settings";
import { addMinutes } from "@/lib/time/duration";
import { type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";
import {
  evenTargets,
  findEarliestChunks,
  findEarliestSlot,
  findEvenChunks,
  findLatestChunks,
  findLatestSlot,
} from "./search";
import { type FocusDay, fill, full, overCap, raiseCaps, trimToRoom } from "./focus-cap";
import { openTo, taskWindow } from "./task-time";
import { byUrgency, type TaskOrder } from "./urgency";

/** How to place tasks: in which order, and whether to rank the rest again after each placement. */
export interface PlanStrategy {
  order: TaskOrder;
  /** Ranks the tasks left again, against the free time then left, after each placement; otherwise only once. */
  reorder: boolean;
}

/** The plan as first tried: tasks most urgent first, by the pressure they start with. */
export const BY_URGENCY: PlanStrategy = { order: byUrgency, reorder: false };

export interface PlacementResult {
  /** In placement order. */
  placements: Placement[];
  unplaced: Task[];
}

/**
 * Places each task, in `strategy`'s order, as its `spread` asks: at its earliest fit (`asap`), centred in its share of
 * the free time in its window (`even`, see `evenTargets`, falling back to `asap` when that finds no room) or at its
 * latest fit (`just-in-time`). A task goes in one block, or for a split task in chunks (see `findEarliestChunks`) at
 * least `CHUNK_BREAK_MIN` apart, also from its chunks in `placed`. It is placed whole or not at all.
 *
 * With focus `days`, which count what's already filled, a task first leaves out the days that are full, and cuts
 * each day its blocks would fill past its cap down to the room left (see `trimToRoom`), searching again until its
 * blocks fit under every cap. Only if that finds no room does it go over the caps, by as little as it can, at most by
 * the last of `capRaisesMin`.
 */
export function placeTasks(
  tasks: Task[],
  free: IntervalSet,
  placed: readonly Placement[] = [],
  days: FocusDay[] = [],
  strategy: PlanStrategy = BY_URGENCY,
  capRaisesMin: readonly number[] = FOCUS_CAP_RAISES_MIN,
): PlacementResult {
  let remaining = free;
  let focus = days;
  const placements: Placement[] = [];
  const unplaced: Task[] = [];

  for (let queue = strategy.order(tasks, remaining); queue.length > 0;) {
    const [task, ...rest] = queue;
    const place = (open: IntervalSet) =>
      task.spread === "even"
        ? (findBlocks(task, "even", open, placed) ?? findBlocks(task, "asap", open, placed))
        : findBlocks(task, task.spread, open, placed);
    const placeUnder = (caps: FocusDay[]) => {
      for (let open = subtractIntervals(remaining, full(caps)); ;) {
        const found = place(open);
        if (!found) return null;
        const over = overCap(caps, found);
        if (over.length === 0) return found;
        open = trimToRoom(open, over, found);
      }
    };

    let blocks: Interval[] | null = null;
    for (const extraMin of capRaisesMin) {
      blocks = placeUnder(raiseCaps(focus, extraMin));
      if (blocks) break;
    }
    if (blocks) {
      focus = fill(focus, blocks);
      placements.push(
        ...blocks.map((block) => ({
          taskId: task.id,
          ...block,
          pinned: false,
          status: "planned" as const,
        })),
      );
      remaining = subtractIntervals(remaining, blocks);
    } else {
      unplaced.push(task);
    }
    queue = strategy.reorder ? strategy.order(rest, remaining) : rest;
  }
  return { placements, unplaced };
}

function findBlocks(
  task: Task,
  spread: SpreadStrategy,
  freeTime: IntervalSet,
  placed: readonly Placement[],
): Interval[] | null {
  const { id, durationMin, split } = task;
  const window = taskWindow(task);
  const free = openTo(task, freeTime);
  if (!split) {
    const slot =
      spread === "just-in-time"
        ? findLatestSlot(free, durationMin, window)
        : findEarliestSlot(
            free,
            durationMin,
            spread === "even" ? { start: evenTargets(free, window, durationMin, 1)[0], end: window.end } : window,
          );
    return slot && [slot];
  }

  const breaks = placed
    .filter((placement) => placement.taskId === id)
    .map((placement) => ({
      start: addMinutes(placement.start, -CHUNK_BREAK_MIN),
      end: addMinutes(placement.end, CHUNK_BREAK_MIN),
    }));
  const open = subtractIntervals(free, breaks);
  const find = spread === "even" ? findEvenChunks : spread === "just-in-time" ? findLatestChunks : findEarliestChunks;
  return find(open, durationMin, window, split, CHUNK_BREAK_MIN);
}
